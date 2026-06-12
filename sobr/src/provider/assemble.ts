import type { AssembledMessage, ContentBlock, StreamEvent, Usage } from "./types.ts";

type PartialBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; json: string };

/**
 * Accumulate a stream of events into a complete assistant message.
 * This is the week-1 "riskiest item" from plan.md: tool_use inputs arrive as
 * split input_json_delta fragments that must be concatenated, then parsed once
 * at content_block_stop. Used identically by the live provider and FakeAnthropic.
 *
 * onEvent (optional) sees every event as it is consumed — the renderer hook.
 */
export async function assemble(
  events: AsyncIterable<StreamEvent> | Iterable<StreamEvent>,
  onEvent?: (ev: StreamEvent) => void,
): Promise<AssembledMessage> {
  const blocks = new Map<number, PartialBlock>();
  const done: { index: number; block: ContentBlock }[] = [];
  let id = "";
  let model = "";
  let stopReason: string | null = null;
  const usage: Usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };

  for await (const ev of events) {
    onEvent?.(ev);
    switch (ev.type) {
      case "message_start": {
        id = ev.message.id;
        model = ev.message.model;
        const u = ev.message.usage;
        if (u) {
          usage.inputTokens = u.input_tokens ?? 0;
          usage.cacheReadTokens = u.cache_read_input_tokens ?? 0;
          usage.cacheWriteTokens = u.cache_creation_input_tokens ?? 0;
        }
        break;
      }
      case "content_block_start": {
        const cb = ev.content_block;
        blocks.set(
          ev.index,
          cb.type === "text"
            ? { type: "text", text: cb.text }
            : { type: "tool_use", id: cb.id, name: cb.name, json: "" },
        );
        break;
      }
      case "content_block_delta": {
        const block = blocks.get(ev.index);
        if (!block) throw new Error(`content_block_delta for unknown index ${ev.index}`);
        if (ev.delta.type === "text_delta") {
          if (block.type !== "text") throw new Error(`text_delta for non-text block ${ev.index}`);
          block.text += ev.delta.text;
        } else {
          if (block.type !== "tool_use") throw new Error(`input_json_delta for non-tool block ${ev.index}`);
          block.json += ev.delta.partial_json;
        }
        break;
      }
      case "content_block_stop": {
        const block = blocks.get(ev.index);
        if (!block) throw new Error(`content_block_stop for unknown index ${ev.index}`);
        blocks.delete(ev.index);
        if (block.type === "text") {
          done.push({ index: ev.index, block: { type: "text", text: block.text } });
        } else {
          let input: Record<string, unknown>;
          try {
            input = block.json.trim() === "" ? {} : JSON.parse(block.json);
          } catch (e) {
            throw new Error(`Malformed tool_use input JSON for ${block.name}: ${(e as Error).message}`);
          }
          done.push({ index: ev.index, block: { type: "tool_use", id: block.id, name: block.name, input } });
        }
        break;
      }
      case "message_delta": {
        if (ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
        if (ev.usage?.output_tokens != null) usage.outputTokens = ev.usage.output_tokens;
        break;
      }
      case "message_stop":
        break;
    }
  }

  if (blocks.size > 0) throw new Error("Stream ended with unterminated content blocks (aborted?)");
  done.sort((a, b) => a.index - b.index);
  return {
    id,
    model,
    content: done.map((d) => d.block),
    stopReason: stopReason ?? "end_turn",
    usage,
  };
}
