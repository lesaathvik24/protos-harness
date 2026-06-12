import type { AssembledMessage, Msg, Provider, StreamEvent, Usage } from "../provider/types.ts";
import { assemble } from "../provider/assemble.ts";
import { dispatchToolCall, type DispatchDeps } from "./dispatch.ts";
import type { SobrConfig } from "../config/config.ts";
import type { TraceEmitter, TraceEvent } from "../trace/events.ts";
import { digestOf, sha256Of } from "../trace/events.ts";
import { costUsd } from "../trace/cost.ts";

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
  private turn = 0;

  constructor(private deps: AgentDeps) {
    // Pipeline stages report decisions via dispatch.onTrace; the agent stamps
    // turn/ts and forwards to the session trace (chaining any user hook).
    const userOnTrace = deps.dispatch.onTrace;
    deps.dispatch.onTrace = (ev) => {
      userOnTrace?.(ev);
      this.trace(ev);
    };
  }

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
        if (signal?.aborted) return; // discard partial message
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
        const result = await dispatchToolCall(call, this.deps.dispatch);
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
