import Anthropic from "@anthropic-ai/sdk";
import type { Provider, ProviderRequest, StreamEvent } from "./types.ts";

/**
 * Live provider over the official SDK. maxRetries:4 per plan.md.
 *
 * Prompt-cache breakpoints (max 4 allowed; we use 3):
 *   1. last tool definition   — tools render first in the prefix
 *   2. last system block      — caches tools+system together
 *   3. last message block     — conversation prefix cache-hits on every tool iteration
 */
export class AnthropicProvider implements Provider {
  private client: Anthropic;

  constructor(opts: { apiKey?: string } = {}) {
    this.client = new Anthropic({ apiKey: opts.apiKey, maxRetries: 4 });
  }

  async *stream(req: ProviderRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const ephemeral = { type: "ephemeral" as const };

    const tools = req.tools.map((t, i) =>
      i === req.tools.length - 1 ? { ...t, cache_control: ephemeral } : t,
    );
    const system = [{ type: "text" as const, text: req.system, cache_control: ephemeral }];
    const messages = req.messages.map((m, i) => {
      if (i !== req.messages.length - 1 || m.content.length === 0) return m;
      const content = m.content.map((b, j) =>
        j === m.content.length - 1 ? { ...b, cache_control: ephemeral } : b,
      );
      return { ...m, content };
    });

    const stream = await this.client.messages.create(
      {
        model: req.model,
        max_tokens: req.maxTokens,
        system,
        tools: tools as Anthropic.ToolUnion[],
        messages: messages as unknown as Anthropic.MessageParam[],
        stream: true,
      },
      { signal },
    );

    for await (const ev of stream) {
      // Our StreamEvent union is a structural subset of the SDK raw events;
      // pass through the ones we model, drop the rest (e.g. ping).
      switch (ev.type) {
        case "message_start":
        case "content_block_start":
        case "content_block_delta":
        case "content_block_stop":
        case "message_delta":
        case "message_stop":
          yield ev as unknown as StreamEvent;
          break;
      }
    }
  }
}
