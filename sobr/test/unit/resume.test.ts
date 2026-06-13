import { describe, expect, test } from "bun:test";
import { historyFromTrace, isResumable } from "../../src/trace/resume.ts";
import type { TraceEvent } from "../../src/trace/events.ts";
import type { Msg } from "../../src/provider/types.ts";

const userMsg = (t: string): Msg => ({ role: "user", content: [{ type: "text", text: t }] });

function base(): TraceEvent[] {
  return [{ type: "session_start", ts: "t", turn: 0, sessionId: "s", cwd: "/x", model: "claude-sonnet-4-6", provider: "anthropic" }];
}

describe("historyFromTrace", () => {
  test("empty / no requests → []", () => {
    expect(historyFromTrace([])).toEqual([]);
    expect(historyFromTrace(base())).toEqual([]);
    expect(isResumable(base())).toBe(false);
  });

  test("a finished turn: last request messages + the final assistant answer", () => {
    const events: TraceEvent[] = [
      ...base(),
      { type: "user_input", ts: "t", turn: 1, text: "hi" },
      { type: "api_request", ts: "t", turn: 1, iteration: 0, request: { model: "m", system: "s", messages: [userMsg("hi")], toolNames: [] } },
      { type: "api_response", ts: "t", turn: 1, iteration: 0, id: "r", model: "m", stopReason: "end_turn", content: [{ type: "text", text: "hello!" }], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 },
      { type: "turn_end", ts: "t", turn: 1, usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 },
    ];
    const history = historyFromTrace(events);
    expect(history).toEqual([userMsg("hi"), { role: "assistant", content: [{ type: "text", text: "hello!" }] }]);
    expect(isResumable(events)).toBe(true);
  });

  test("multi-iteration tool turn: uses the LAST request (full tool_result bodies) + final answer", () => {
    const afterToolsMessages: Msg[] = [
      userMsg("read the file"),
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "read", input: { path: "a.txt" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "FULL FILE CONTENTS" }] },
    ];
    const events: TraceEvent[] = [
      ...base(),
      { type: "user_input", ts: "t", turn: 1, text: "read the file" },
      { type: "api_request", ts: "t", turn: 1, iteration: 0, request: { model: "m", system: "s", messages: [userMsg("read the file")], toolNames: ["read"] } },
      { type: "api_response", ts: "t", turn: 1, iteration: 0, id: "r0", model: "m", stopReason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "read", input: { path: "a.txt" } }], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 },
      { type: "api_request", ts: "t", turn: 1, iteration: 1, request: { model: "m", system: "s", messages: afterToolsMessages, toolNames: ["read"] } },
      { type: "api_response", ts: "t", turn: 1, iteration: 1, id: "r1", model: "m", stopReason: "end_turn", content: [{ type: "text", text: "the file says hi" }], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 },
    ];
    const history = historyFromTrace(events);
    // full tool_result body preserved (not the truncated digest)
    expect(history).toHaveLength(4);
    expect((history[2]!.content[0] as { content: string }).content).toBe("FULL FILE CONTENTS");
    expect(history[3]).toEqual({ role: "assistant", content: [{ type: "text", text: "the file says hi" }] });
  });

  test("a trailing tool_use response (session ended mid-turn) is dropped — resume from the clean request point", () => {
    const events: TraceEvent[] = [
      ...base(),
      { type: "api_request", ts: "t", turn: 1, iteration: 0, request: { model: "m", system: "s", messages: [userMsg("do it")], toolNames: ["bash"] } },
      { type: "api_response", ts: "t", turn: 1, iteration: 0, id: "r", model: "m", stopReason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "bash", input: {} }], usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 }, costUsd: 0 },
    ];
    expect(historyFromTrace(events)).toEqual([userMsg("do it")]); // assistant tool_use NOT appended
  });
});
