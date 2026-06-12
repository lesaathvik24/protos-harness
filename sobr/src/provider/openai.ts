// OpenAI-compatible provider: covers OpenAI (GPT), DeepSeek, and anything else
// speaking the /chat/completions wire format. It normalizes that stream into
// the same StreamEvent union the Anthropic provider emits, so the loop,
// assemble(), renderer and trace never know the difference.
//
// Notes vs Anthropic:
// - No cache_control breakpoints — these providers cache automatically; we map
//   their cached-token counters onto usage.cacheReadTokens for the status line.
// - Tool calls arrive as tool_calls[] deltas with split JSON `arguments` —
//   normalized to content_block_start(tool_use) + input_json_delta, which is
//   exactly what assemble() already handles.

import type { ContentBlock, Msg, Provider, ProviderRequest, StreamEvent } from "./types.ts";

export interface OpenAIChunk {
  id?: string;
  model?: string;
  choices?: {
    index: number;
    delta?: {
      content?: string | null;
      tool_calls?: {
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    /** DeepSeek's cache counters */
    prompt_cache_hit_tokens?: number;
  } | null;
}

function toOpenAIMessages(system: string, messages: Msg[]): unknown[] {
  const out: unknown[] = [{ role: "system", content: system }];
  for (const msg of messages) {
    if (msg.role === "assistant") {
      const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const toolCalls = msg.content
        .filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          type: "function",
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        }));
      out.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
    } else {
      // user message: tool_results become role:"tool" messages; text stays user
      for (const block of msg.content) {
        if (block.type === "tool_result") {
          const content = block.is_error ? `ERROR: ${block.content}` : block.content;
          out.push({ role: "tool", tool_call_id: block.tool_use_id, content });
        } else if (block.type === "text") {
          out.push({ role: "user", content: block.text });
        }
      }
    }
  }
  return out;
}

/** Pure request translation — unit-tested without a network. */
export function toOpenAIRequest(req: ProviderRequest): Record<string, unknown> {
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: toOpenAIMessages(req.system, req.messages),
    ...(req.tools.length > 0
      ? {
          tools: req.tools.map((t) => ({
            type: "function",
            function: { name: t.name, description: t.description, parameters: t.input_schema },
          })),
        }
      : {}),
  };
}

function mapStopReason(reason: string): string {
  switch (reason) {
    case "tool_calls":
      return "tool_use";
    case "stop":
      return "end_turn";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "end_turn";
  }
}

/** Pure chunk → StreamEvent normalization — unit-tested with scripted chunks. */
export async function* normalizeChunks(chunks: AsyncIterable<OpenAIChunk> | Iterable<OpenAIChunk>): AsyncIterable<StreamEvent> {
  let started = false;
  let textIndex: number | null = null;
  const toolIndices = new Map<number, number>(); // openai tool_calls index → our block index
  let nextIndex = 0;
  let stopReason = "end_turn";
  let usage: OpenAIChunk["usage"] = null;

  for await (const chunk of chunks) {
    if (!started) {
      started = true;
      yield { type: "message_start", message: { id: chunk.id ?? "openai", model: chunk.model ?? "" } };
    }
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const delta = choice.delta;
    if (delta?.content) {
      if (textIndex === null) {
        textIndex = nextIndex++;
        yield { type: "content_block_start", index: textIndex, content_block: { type: "text", text: "" } };
      }
      yield { type: "content_block_delta", index: textIndex, delta: { type: "text_delta", text: delta.content } };
    }
    for (const tc of delta?.tool_calls ?? []) {
      let idx = toolIndices.get(tc.index);
      if (idx === undefined) {
        idx = nextIndex++;
        toolIndices.set(tc.index, idx);
        yield {
          type: "content_block_start",
          index: idx,
          content_block: { type: "tool_use", id: tc.id ?? `call_${tc.index}`, name: tc.function?.name ?? "" },
        };
      }
      if (tc.function?.arguments) {
        yield { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: tc.function.arguments } };
      }
    }
    if (choice.finish_reason) stopReason = mapStopReason(choice.finish_reason);
  }

  if (textIndex !== null) yield { type: "content_block_stop", index: textIndex };
  for (const idx of [...toolIndices.values()].sort((a, b) => a - b)) {
    yield { type: "content_block_stop", index: idx };
  }

  const cacheRead = usage?.prompt_tokens_details?.cached_tokens ?? usage?.prompt_cache_hit_tokens ?? 0;
  const prompt = usage?.prompt_tokens ?? 0;
  yield {
    type: "message_delta",
    delta: { stop_reason: stopReason },
    usage: {
      output_tokens: usage?.completion_tokens ?? 0,
      input_tokens: Math.max(0, prompt - cacheRead),
      cache_read_input_tokens: cacheRead,
      cache_creation_input_tokens: 0,
    },
  };
  yield { type: "message_stop" };
}

/** Parse an SSE byte stream into OpenAI chunks. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncIterable<OpenAIChunk> {
  const decoder = new TextDecoder();
  let buffer = "";
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      yield JSON.parse(data);
    }
  }
}

export class OpenAICompatProvider implements Provider {
  constructor(private opts: { apiKey: string; baseUrl: string; maxRetries?: number }) {}

  async *stream(req: ProviderRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const url = `${this.opts.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const maxRetries = this.opts.maxRetries ?? 4;
    let res: Response | null = null;
    for (let attempt = 0; ; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify(toOpenAIRequest(req)),
        signal,
      });
      if (res.ok) break;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= maxRetries) {
        const body = await res.text().catch(() => "");
        throw new Error(`Provider error ${res.status}: ${body.slice(0, 500)}`);
      }
      await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
    }
    if (!res.body) throw new Error("Provider returned no body");
    yield* normalizeChunks(parseSSE(res.body));
  }
}
