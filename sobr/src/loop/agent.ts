import type { AssembledMessage, Msg, Provider, StreamEvent, Usage } from "../provider/types.ts";
import { assemble } from "../provider/assemble.ts";
import { dispatchToolCall, type DispatchDeps } from "./dispatch.ts";
import type { SobrConfig } from "../config/config.ts";

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
}

const MAX_ITERATIONS = 50;

export class Agent {
  history: Msg[] = [];
  totalUsage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

  constructor(private deps: AgentDeps) {}

  private emit(ev: UiEvent) {
    this.deps.onUiEvent?.(ev);
  }

  /**
   * One user turn: stream assistant message → if stop is tool_use, run the
   * dispatch pipeline for every tool_use block and send results back as ONE
   * user message → continue until end_turn. An aborted stream discards the
   * partial assistant message (history stays consistent).
   */
  async runTurn(userInput: string, signal?: AbortSignal): Promise<void> {
    this.history.push({ role: "user", content: [{ type: "text", text: userInput }] });

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      let message: AssembledMessage;
      try {
        message = await assemble(
          this.deps.provider.stream(
            {
              model: this.deps.config.model,
              system: this.deps.system,
              messages: this.history,
              tools: this.deps.dispatch.registry.specs(),
              maxTokens: this.deps.config.maxTokens,
            },
            signal,
          ),
          (ev) => this.onStreamEvent(ev),
        );
      } catch (e) {
        if (signal?.aborted) return; // discard partial message
        throw e;
      }

      this.tallyUsage(message.usage);
      this.history.push({ role: "assistant", content: message.content });
      this.emit({ type: "assistant_done" });

      if (message.stopReason !== "tool_use") {
        this.emit({ type: "turn_end", usage: this.totalUsage });
        return;
      }

      const calls = message.content.filter((b) => b.type === "tool_use");
      const results = [];
      for (const call of calls) {
        this.emit({ type: "tool_call", id: call.id, name: call.name, input: call.input });
        const result = await dispatchToolCall(call, this.deps.dispatch);
        this.emit({
          type: "tool_result",
          id: call.id,
          name: call.name,
          content: result.content,
          isError: result.is_error ?? false,
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

  private tallyUsage(u: Usage) {
    this.totalUsage.inputTokens += u.inputTokens;
    this.totalUsage.outputTokens += u.outputTokens;
    this.totalUsage.cacheReadTokens += u.cacheReadTokens;
    this.totalUsage.cacheWriteTokens += u.cacheWriteTokens;
  }
}
