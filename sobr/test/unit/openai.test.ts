import { describe, expect, test } from "bun:test";
import { toOpenAIRequest, normalizeChunks, type OpenAIChunk } from "../../src/provider/openai.ts";
import { assemble } from "../../src/provider/assemble.ts";
import type { ProviderRequest } from "../../src/provider/types.ts";

const baseReq: ProviderRequest = {
  model: "deepseek-chat",
  system: "be sober",
  maxTokens: 1000,
  tools: [{ name: "read", description: "Read a file", input_schema: { type: "object" } }],
  messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
};

describe("toOpenAIRequest (wire translation)", () => {
  test("system becomes a system message; tools become functions", () => {
    const req = toOpenAIRequest(baseReq) as any;
    expect(req.model).toBe("deepseek-chat");
    expect(req.stream).toBe(true);
    expect(req.messages[0]).toEqual({ role: "system", content: "be sober" });
    expect(req.tools[0]).toEqual({
      type: "function",
      function: { name: "read", description: "Read a file", parameters: { type: "object" } },
    });
  });

  test("assistant tool_use becomes tool_calls; tool_result becomes role:tool", () => {
    const req = toOpenAIRequest({
      ...baseReq,
      messages: [
        { role: "user", content: [{ type: "text", text: "read it" }] },
        {
          role: "assistant",
          content: [
            { type: "text", text: "ok" },
            { type: "tool_use", id: "t1", name: "read", input: { path: "a.txt" } },
          ],
        },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "data", is_error: true }] },
      ],
    }) as any;
    const assistant = req.messages[2];
    expect(assistant.tool_calls[0]).toEqual({
      id: "t1",
      type: "function",
      function: { name: "read", arguments: '{"path":"a.txt"}' },
    });
    const toolMsg = req.messages[3];
    expect(toolMsg).toEqual({ role: "tool", tool_call_id: "t1", content: "ERROR: data" });
  });
});

describe("normalizeChunks → assemble (end to end without a network)", () => {
  test("text turn", async () => {
    const chunks: OpenAIChunk[] = [
      { id: "c1", model: "gpt-x", choices: [{ index: 0, delta: { content: "Hel" } }] },
      { choices: [{ index: 0, delta: { content: "lo" } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 5 } },
    ];
    const msg = await assemble(normalizeChunks(chunks));
    expect(msg.content).toEqual([{ type: "text", text: "Hello" }]);
    expect(msg.stopReason).toBe("end_turn");
    expect(msg.usage.inputTokens).toBe(100);
    expect(msg.usage.outputTokens).toBe(5);
  });

  test("tool call with split arguments maps to tool_use", async () => {
    const chunks: OpenAIChunk[] = [
      { id: "c2", model: "deepseek-chat", choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "read", arguments: "" } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: '{"pa' } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: 'th":"x.txt"}' } }] } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
      { choices: [], usage: { prompt_tokens: 50, completion_tokens: 9 } },
    ];
    const msg = await assemble(normalizeChunks(chunks));
    expect(msg.stopReason).toBe("tool_use");
    expect(msg.content).toEqual([{ type: "tool_use", id: "call_1", name: "read", input: { path: "x.txt" } }]);
  });

  test("parallel tool calls keep distinct ids and order", async () => {
    const chunks: OpenAIChunk[] = [
      { id: "c3", choices: [{ index: 0, delta: { tool_calls: [
        { index: 0, id: "call_a", function: { name: "glob", arguments: '{"pattern":"*"}' } },
        { index: 1, id: "call_b", function: { name: "grep", arguments: '{"pattern":"x"}' } },
      ] } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
    ];
    const msg = await assemble(normalizeChunks(chunks));
    const calls = msg.content.filter((b) => b.type === "tool_use");
    expect(calls.map((c) => c.id)).toEqual(["call_a", "call_b"]);
  });

  test("cached tokens map to cacheReadTokens (OpenAI and DeepSeek shapes)", async () => {
    const openaiStyle: OpenAIChunk[] = [
      { id: "c4", choices: [{ index: 0, delta: { content: "x" }, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 1, prompt_tokens_details: { cached_tokens: 80 } } },
    ];
    const msg = await assemble(normalizeChunks(openaiStyle));
    expect(msg.usage.cacheReadTokens).toBe(80);
    expect(msg.usage.inputTokens).toBe(20);

    const deepseekStyle: OpenAIChunk[] = [
      { id: "c5", choices: [{ index: 0, delta: { content: "x" }, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 1, prompt_cache_hit_tokens: 60 } },
    ];
    const msg2 = await assemble(normalizeChunks(deepseekStyle));
    expect(msg2.usage.cacheReadTokens).toBe(60);
  });

  test("length and content_filter finish reasons map", async () => {
    const make = (reason: string): OpenAIChunk[] => [
      { id: "c", choices: [{ index: 0, delta: { content: "x" }, finish_reason: reason }] },
    ];
    expect((await assemble(normalizeChunks(make("length")))).stopReason).toBe("max_tokens");
    expect((await assemble(normalizeChunks(make("content_filter")))).stopReason).toBe("refusal");
  });
});
