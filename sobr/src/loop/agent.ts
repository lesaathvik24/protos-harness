import type { AssembledMessage, Msg, Provider, StreamEvent, Usage } from "../provider/types.ts";
import { assemble } from "../provider/assemble.ts";
import { dispatchToolCall, type DispatchDeps } from "./dispatch.ts";
import type { SobrConfig } from "../config/config.ts";
import type { TraceEmitter, TraceEvent } from "../trace/events.ts";
import { digestOf, sha256Of } from "../trace/events.ts";
import { costUsd, contextWindowFor } from "../trace/cost.ts";

const COMPACT_SYSTEM =
  "You are compacting a coding-agent transcript. Produce a dense summary that preserves: the user's " +
  "goal and constraints, decisions made (and why), files created/edited and their current state, " +
  "commands run and their outcomes, and any open/next tasks. Be specific about file paths and names. " +
  "Omit chit-chat. This summary REPLACES the transcript, so anything you drop is lost.";

/** UI-facing events. The renderer is a pure fn over these (replay reuses it in week 2). */
export type UiEvent =
  | { type: "text_delta"; text: string }
  | { type: "assistant_done" }
  | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; content: string; isError: boolean }
  | { type: "turn_end"; usage: Usage };

export interface AgentDeps {
  provider: Provider;
  config: SobrConfig;
  system: string;
  dispatch: DispatchDeps;
  onUiEvent?: (ev: UiEvent) => void;
  trace?: TraceEmitter;
}

const MAX_ITERATIONS = 50;

/** Distributive Omit — plain Omit collapses a discriminated union to its shared keys. */
type TraceEventBody = TraceEvent extends infer T ? (T extends TraceEvent ? Omit<T, "ts" | "turn"> : never) : never;

export class Agent {
  history: Msg[] = [];
  totalUsage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
  totalCostUsd = 0;
  /** null once any response came from a model with unknown pricing. */
  costKnown = true;
  /** Prompt tokens the model saw on the most recent request (input + cache) — drives compaction warnings. */
  lastPromptTokens = 0;
  private turn = 0;

  /** Seed history when resuming a prior session (sobr resume). */
  loadHistory(history: Msg[]): void {
    this.history = history;
  }

  /** Fraction (0–1) of the model's context window the last prompt used. */
  contextFraction(): number {
    return this.lastPromptTokens / contextWindowFor(this.deps.config.model);
  }

  /** Current turn number (teach trace events stamp this). */
  get turnNumber(): number {
    return this.turn;
  }

  /** Any caller-supplied dispatch trace hook, captured so we don't mutate the shared deps. */
  private readonly userOnTrace?: DispatchDeps["onTrace"];

  constructor(public deps: AgentDeps) {
    this.userOnTrace = deps.dispatch.onTrace;
  }

  /** Pipeline-stage trace: forward to the caller hook, then stamp + emit to the session trace. */
  private dispatchOnTrace = (ev: Parameters<NonNullable<DispatchDeps["onTrace"]>>[0]) => {
    this.userOnTrace?.(ev);
    this.trace(ev);
  };

  private emit(ev: UiEvent) {
    this.deps.onUiEvent?.(ev);
  }

  private trace(ev: TraceEventBody) {
    this.deps.trace?.emit({ ...ev, ts: new Date().toISOString(), turn: this.turn } as TraceEvent);
  }

  /**
   * One user turn: stream assistant message → if stop is tool_use, run the
   * dispatch pipeline for every tool_use block and send results back as ONE
   * user message → continue until end_turn. An aborted stream discards the
   * partial assistant message (history stays consistent).
   */
  async runTurn(userInput: string, signal?: AbortSignal): Promise<void> {
    this.turn++;
    this.trace({ type: "user_input", text: userInput });
    this.history.push({ role: "user", content: [{ type: "text", text: userInput }] });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const request = {
        model: this.deps.config.model,
        system: this.deps.system,
        messages: this.history,
        tools: this.deps.dispatch.registry.specs(),
        maxTokens: this.deps.config.maxTokens,
      };
      this.trace({
        type: "api_request",
        iteration: i,
        request: {
          model: request.model,
          system: request.system,
          // full messages array — deliberate redundancy; makes `why` trivially correct
          messages: structuredClone(this.history),
          toolNames: request.tools.map((t) => t.name),
        },
      });

      let message: AssembledMessage;
      try {
        message = await assemble(this.deps.provider.stream(request, signal), (ev) => this.onStreamEvent(ev));
      } catch (e) {
        if (signal?.aborted) {
          // Discard the partial assistant message, but mark the trace so the
          // api_request just emitted isn't an orphan with no response.
          this.trace({ type: "turn_aborted", iteration: i });
          return;
        }
        throw e;
      }

      const cost = costUsd(message.model || this.deps.config.model, message.usage);
      this.trace({
        type: "api_response",
        iteration: i,
        id: message.id,
        model: message.model,
        stopReason: message.stopReason,
        content: message.content,
        usage: message.usage,
        costUsd: cost,
      });
      this.tallyUsage(message.usage, cost);
      this.lastPromptTokens = message.usage.inputTokens + message.usage.cacheReadTokens + message.usage.cacheWriteTokens;
      this.history.push({ role: "assistant", content: message.content });
      this.emit({ type: "assistant_done" });

      if (message.stopReason !== "tool_use") {
        this.trace({ type: "turn_end", usage: this.totalUsage, costUsd: this.totalCostUsd });
        this.emit({ type: "turn_end", usage: this.totalUsage });
        return;
      }

      const calls = message.content.filter((b) => b.type === "tool_use");
      const results = [];
      for (const call of calls) {
        this.emit({ type: "tool_call", id: call.id, name: call.name, input: call.input });
        this.trace({ type: "tool_call", id: call.id, name: call.name, input: call.input });
        // Spread reads the CURRENT dispatch (registry swaps from /teach still apply)
        // while overriding onTrace locally — no mutation of the shared deps object.
        const result = await dispatchToolCall(call, { ...this.deps.dispatch, onTrace: this.dispatchOnTrace });
        this.emit({
          type: "tool_result",
          id: call.id,
          name: call.name,
          content: result.content,
          isError: result.is_error ?? false,
        });
        this.trace({
          type: "tool_result",
          id: call.id,
          name: call.name,
          isError: result.is_error ?? false,
          digest: digestOf(result.content),
          sha256: sha256Of(result.content),
          bytes: result.content.length,
        });
        results.push(result);
      }
      this.history.push({ role: "user", content: results });
    }
    throw new Error(`Turn exceeded ${MAX_ITERATIONS} iterations`);
  }

  /**
   * Manual compaction: one summarize call (no tools) that REPLACES history with
   * a dense summary, so a long session keeps going without blowing the context
   * window. Logs a `compaction` trace event. Returns the summary text.
   */
  async compact(signal?: AbortSignal): Promise<string> {
    if (this.history.length === 0) return "(nothing to compact)";
    const beforeMessages = this.history.length;
    const beforeTokens = this.lastPromptTokens;

    const summarizeMessages: Msg[] = [
      ...this.history,
      { role: "user", content: [{ type: "text", text: "Summarize everything above per your instructions. Output only the summary." }] },
    ];
    const message = await assemble(
      this.deps.provider.stream(
        { model: this.deps.config.model, system: COMPACT_SYSTEM, messages: summarizeMessages, tools: [], maxTokens: this.deps.config.maxTokens },
        signal,
      ),
    );
    const summary = message.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!summary) throw new Error("compaction produced an empty summary");

    const cost = costUsd(message.model || this.deps.config.model, message.usage);
    this.tallyUsage(message.usage, cost);

    // Replace the transcript with the summary as primed context.
    this.history = [
      { role: "user", content: [{ type: "text", text: `[Earlier conversation, compacted]\n${summary}` }] },
      { role: "assistant", content: [{ type: "text", text: "Understood — I have the summary and will continue from here." }] },
    ];
    this.lastPromptTokens = Math.ceil((COMPACT_SYSTEM.length + summary.length) / 4); // rough re-baseline

    this.trace({
      type: "compaction",
      payload: { beforeMessages, afterMessages: this.history.length, beforeTokens, summaryChars: summary.length },
    });
    return summary;
  }

  private onStreamEvent(ev: StreamEvent) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
      this.emit({ type: "text_delta", text: ev.delta.text });
    }
  }

  private tallyUsage(u: Usage, cost: number | null) {
    this.totalUsage.inputTokens += u.inputTokens;
    this.totalUsage.outputTokens += u.outputTokens;
    this.totalUsage.cacheReadTokens += u.cacheReadTokens;
    this.totalUsage.cacheWriteTokens += u.cacheWriteTokens;
    if (cost === null) this.costKnown = false;
    else this.totalCostUsd += cost;
  }
}
