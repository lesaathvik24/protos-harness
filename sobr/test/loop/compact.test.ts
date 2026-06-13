import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "../../src/loop/agent.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";
import { PolicyEngine } from "../../src/policy/engine.ts";
import { TeachOffGate } from "../../src/teach/gate.ts";
import { PermissionGate } from "../../src/permission/gate.ts";
import { DEFAULT_CONFIG } from "../../src/config/config.ts";
import { FakeAnthropic, loadFixture } from "../helpers/fake.ts";
import type { StreamEvent } from "../../src/provider/types.ts";
import type { TraceEvent } from "../../src/trace/events.ts";

function summaryTurn(text: string): StreamEvent[] {
  return [
    { type: "message_start", message: { id: "sum", model: "claude-sonnet-4-6", usage: { input_tokens: 500 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 40 } },
    { type: "message_stop" },
  ];
}

async function makeAgent(scripts: StreamEvent[][]) {
  const cwd = await mkdtemp(join(tmpdir(), "sobr-compact-"));
  const events: TraceEvent[] = [];
  const agent = new Agent({
    provider: new FakeAnthropic(scripts),
    config: DEFAULT_CONFIG,
    system: "base system",
    trace: { emit: (ev) => events.push(ev) },
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(),
      teachGate: new TeachOffGate(),
      permission: new PermissionGate(async () => "n"),
      ctx: { cwd },
    },
  });
  return { agent, events };
}

describe("compaction", () => {
  test("replaces history with a primed summary and logs a compaction event", async () => {
    const { agent, events } = await makeAgent([await loadFixture("text-turn"), summaryTurn("User is building X. Created a.ts. Next: add tests.")]);
    await agent.runTurn("hello");
    const beforeLen = agent.history.length;
    expect(beforeLen).toBeGreaterThan(0);

    const summary = await agent.compact();
    expect(summary).toContain("Created a.ts");
    // history is now exactly the summary user-msg + an assistant ack
    expect(agent.history).toHaveLength(2);
    expect(agent.history[0]!.role).toBe("user");
    expect((agent.history[0]!.content[0] as { text: string }).text).toContain("compacted");
    expect((agent.history[0]!.content[0] as { text: string }).text).toContain("Created a.ts");
    expect(agent.history[1]!.role).toBe("assistant");

    const compactionEv = events.find((e) => e.type === "compaction");
    expect(compactionEv).toBeDefined();
    if (compactionEv?.type === "compaction") {
      expect(compactionEv.payload.afterMessages).toBe(2);
      expect(compactionEv.payload.summaryChars).toBeGreaterThan(0);
    }
  });

  test("the summarize call sends NO tools (so the model can't tool-call mid-summary)", async () => {
    const provider = new FakeAnthropic([summaryTurn("summary text")]);
    const cwd = await mkdtemp(join(tmpdir(), "sobr-compact2-"));
    const agent = new Agent({
      provider,
      config: DEFAULT_CONFIG,
      system: "s",
      dispatch: {
        registry: defaultRegistry(),
        policy: new PolicyEngine(),
        teachGate: new TeachOffGate(),
        permission: new PermissionGate(async () => "n"),
        ctx: { cwd },
      },
    });
    agent.loadHistory([{ role: "user", content: [{ type: "text", text: "earlier work" }] }]);
    await agent.compact();
    expect(provider.requests[0]!.tools).toEqual([]);
    expect(provider.requests[0]!.system).toContain("compacting");
  });

  test("empty history compacts to a no-op", async () => {
    const { agent } = await makeAgent([]);
    expect(await agent.compact()).toContain("nothing to compact");
  });

  test("contextFraction tracks the last prompt against the model window", async () => {
    const { agent } = await makeAgent([
      [
        { type: "message_start", message: { id: "m", model: "claude-sonnet-4-6", usage: { input_tokens: 500_000, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } },
        { type: "message_stop" },
      ],
    ]);
    await agent.runTurn("big");
    // sonnet-4-6 window is 1M; 500k input → ~0.5
    expect(agent.contextFraction()).toBeCloseTo(0.5, 2);
  });
});
