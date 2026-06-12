// Provider seam. The live AnthropicProvider and the test FakeAnthropic both
// implement Provider; assemble() is the single shared accumulation path so the
// riskiest logic (streamed tool_use input concat) is tested identically for both.

export type Role = "user" | "assistant";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface Msg {
  role: Role;
  content: ContentBlock[];
}

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ProviderRequest {
  model: string;
  system: string;
  messages: Msg[];
  tools: ToolSpec[];
  maxTokens: number;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "refusal" | string;

/** Normalized subset of the Anthropic SSE stream events (same field shapes as the wire). */
export type StreamEvent =
  | { type: "message_start"; message: { id: string; model: string; usage?: Partial<RawUsage> } }
  | {
      type: "content_block_start";
      index: number;
      content_block: { type: "text"; text: string } | { type: "tool_use"; id: string; name: string };
    }
  | {
      type: "content_block_delta";
      index: number;
      delta: { type: "text_delta"; text: string } | { type: "input_json_delta"; partial_json: string };
    }
  | { type: "content_block_stop"; index: number }
  | { type: "message_delta"; delta: { stop_reason: StopReason | null }; usage?: Partial<RawUsage> }
  | { type: "message_stop" };

export interface RawUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface AssembledMessage {
  id: string;
  model: string;
  content: ContentBlock[];
  stopReason: StopReason;
  usage: Usage;
}

export interface Provider {
  stream(req: ProviderRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>;
}
