import { describe, expect, test } from "bun:test";
import { assemble } from "../../src/provider/assemble.ts";
import type { StreamEvent } from "../../src/provider/types.ts";
import { loadFixture } from "../helpers/fake.ts";

describe("assemble (streamed accumulation — the week-1 riskiest item)", () => {
  test("text-only turn", async () => {
    const msg = await assemble(await loadFixture("text-turn"));
    expect(msg.id).toBe("msg_text_1");
    expect(msg.stopReason).toBe("end_turn");
    expect(msg.content).toEqual([{ type: "text", text: "Hello! I can help with that." }]);
    expect(msg.usage.inputTokens).toBe(120);
    expect(msg.usage.outputTokens).toBe(12);
  });

  test("tool_use input split across input_json_delta fragments is reassembled", async () => {
    const msg = await assemble(await loadFixture("single-tool"));
    expect(msg.stopReason).toBe("tool_use");
    expect(msg.content).toHaveLength(2);
    expect(msg.content[1]).toEqual({
      type: "tool_use",
      id: "toolu_read_1",
      name: "read",
      input: { path: "hello.txt" },
    });
  });

  test("parallel tool calls in one message keep order", async () => {
    const msg = await assemble(await loadFixture("parallel-tools"));
    const calls = msg.content.filter((b) => b.type === "tool_use");
    expect(calls.map((c) => c.name)).toEqual(["glob", "grep"]);
    expect(calls[1]!.input).toEqual({ pattern: "TODO" });
    expect(msg.usage.cacheReadTokens).toBe(250);
  });

  test("empty tool input json becomes {}", async () => {
    const events: StreamEvent[] = [
      { type: "message_start", message: { id: "m", model: "x" } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "noargs" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "tool_use" } },
      { type: "message_stop" },
    ];
    const msg = await assemble(events);
    expect(msg.content[0]).toMatchObject({ type: "tool_use", input: {} });
  });

  test("malformed tool input JSON throws with the tool name", async () => {
    const events: StreamEvent[] = [
      { type: "message_start", message: { id: "m", model: "x" } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t1", name: "read" } },
      { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{broken" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_stop" },
    ];
    await expect(assemble(events)).rejects.toThrow(/Malformed tool_use input JSON for read/);
  });

  test("unterminated blocks (aborted stream) throw", async () => {
    const events: StreamEvent[] = [
      { type: "message_start", message: { id: "m", model: "x" } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "partial…" } },
    ];
    await expect(assemble(events)).rejects.toThrow(/unterminated/);
  });

  test("onEvent hook sees every event in order", async () => {
    const fixture = await loadFixture("text-turn");
    const seen: string[] = [];
    await assemble(fixture, (ev) => seen.push(ev.type));
    expect(seen).toEqual(fixture.map((e) => e.type));
  });
});
