import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "../../src/loop/agent.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";
import { PolicyEngine } from "../../src/policy/engine.ts";
import { defaultRules } from "../../src/policy/rules/index.ts";
import { TeachOffGate } from "../../src/teach/gate.ts";
import { PermissionGate, type PermAnswer } from "../../src/permission/gate.ts";
import { DEFAULT_CONFIG } from "../../src/config/config.ts";
import { FakeAnthropic, loadFixture } from "../helpers/fake.ts";
import type { TraceEvent } from "../../src/trace/events.ts";
import type { StreamEvent } from "../../src/provider/types.ts";
import { traceToUiEvents, renderReplay } from "../../src/trace/replay.ts";
import { whyTurn } from "../../src/trace/why.ts";
import { render } from "../../src/ui/render.ts";

async function tracedAgent(scripts: StreamEvent[][], answers: PermAnswer[] = []) {
  const cwd = await mkdtemp(join(tmpdir(), "sobr-tw-"));
  const events: TraceEvent[] = [];
  let i = 0;
  const agent = new Agent({
    provider: new FakeAnthropic(scripts),
    config: DEFAULT_CONFIG,
    system: "test system",
    trace: { emit: (ev) => events.push(ev) },
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(defaultRules()),
      teachGate: new TeachOffGate(),
      permission: new PermissionGate(async () => answers[i++] ?? "n"),
      ctx: { cwd },
    },
  });
  return { agent, events, cwd };
}

describe("trace wiring through the loop (week-2 core)", () => {
  test("tool turn emits the full glass-box sequence", async () => {
    const { agent, events, cwd } = await tracedAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "hi");
    await agent.runTurn("read hello.txt");

    expect(events.map((e) => e.type)).toEqual([
      "user_input",
      "api_request",
      "api_response",
      "tool_call",
      "policy_verdict",
      "teach_gate",
      "perm_decision",
      "tool_result",
      "api_request",
      "api_response",
      "turn_end",
    ]);
    expect(events.every((e) => e.turn === 1)).toBe(true);
  });

  test("api_request carries the FULL messages array (why depends on this)", async () => {
    const { agent, events, cwd } = await tracedAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "hi");
    await agent.runTurn("go");

    const requests = events.filter((e) => e.type === "api_request");
    expect(requests[0]!.request.messages).toHaveLength(1);
    expect(requests[1]!.request.messages).toHaveLength(3); // user, assistant(tool_use), user(tool_result)
    expect(requests[1]!.request.system).toBe("test system");
    expect(requests[1]!.request.toolNames).toContain("read");
  });

  test("api_response carries usage + costUsd; turn_end totals them", async () => {
    const { agent, events } = await tracedAgent([await loadFixture("text-turn")]);
    await agent.runTurn("hi");
    const resp = events.find((e) => e.type === "api_response")!;
    expect(resp.type === "api_response" && resp.costUsd).toBeGreaterThan(0);
    const end = events.find((e) => e.type === "turn_end")!;
    expect(end.type === "turn_end" && end.usage.outputTokens).toBe(12);
    expect(agent.totalCostUsd).toBeGreaterThan(0);
    expect(agent.costKnown).toBe(true);
  });

  test("tool_result trace has digest + sha256 + bytes", async () => {
    const { agent, events, cwd } = await tracedAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "hi");
    await agent.runTurn("go");
    const tr = events.find((e) => e.type === "tool_result")!;
    if (tr.type === "tool_result") {
      expect(tr.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(tr.bytes).toBeGreaterThan(0);
      expect(tr.digest.length).toBeGreaterThan(0);
    }
  });

  test("policy deny is traced and the write never happens", async () => {
    const denyFixture: StreamEvent[] = [
      { type: "message_start", message: { id: "m1", model: "claude-sonnet-4-6" } },
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "tw1", name: "write" } },
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "input_json_delta", partial_json: JSON.stringify({ path: "leak.txt", content: "AKIAIOSFODNN7EXAMPLE" }) },
      },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 10 } },
      { type: "message_stop" },
    ];
    const { agent, events, cwd } = await tracedAgent([denyFixture, await loadFixture("final-answer")], ["y"]);
    await agent.runTurn("write my aws key to a file");

    const verdict = events.find((e) => e.type === "policy_verdict")!;
    expect(verdict.type === "policy_verdict" && verdict.kind).toBe("deny");
    expect(verdict.type === "policy_verdict" && verdict.rule).toBe("secret-scan");
    // no perm_decision: pipeline stopped at policy
    expect(events.some((e) => e.type === "perm_decision")).toBe(false);
    expect(await Bun.file(join(cwd, "leak.txt")).exists()).toBe(false);
    // the model saw the denial in history
    expect(agent.history[2]!.content[0]).toMatchObject({ type: "tool_result", is_error: true });
  });
});

describe("replay + why over a real trace", () => {
  async function recordedSession() {
    const { agent, events, cwd } = await tracedAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "hi from file");
    await agent.runTurn("read hello.txt");
    const all: TraceEvent[] = [
      { type: "session_start", ts: "t", turn: 0, sessionId: "s", cwd, model: "claude-sonnet-4-6", provider: "anthropic" },
      ...events,
    ];
    return all;
  }

  test("replay output is produced by the SAME live renderer", async () => {
    const trace = await recordedSession();
    const replayed = renderReplay(trace);
    // every ui event derived from the trace renders byte-identically via render()
    for (const ui of traceToUiEvents(trace)) {
      expect(replayed).toContain(render(ui).trimEnd().split("\n")[0] ?? "");
    }
    expect(replayed).toContain("sobr> read hello.txt");
    expect(replayed).toContain("Let me read that file.");
    expect(replayed).toContain("Done — the file says hi.");
  });

  test("why <turn> shows full request context and decisions", async () => {
    const trace = await recordedSession();
    const out = whyTurn(trace, 1);
    expect(out).toContain("USER: read hello.txt");
    expect(out).toContain("api_request (iteration 0)");
    expect(out).toContain("api_request (iteration 1)");
    expect(out).toContain('"tool_use"'); // full messages JSON
    expect(out).toContain("permission: allow");
    expect(out).toContain("tool_result read#toolu_read_1");
  });

  test("why on a missing turn lists available turns", async () => {
    const trace = await recordedSession();
    expect(whyTurn(trace, 9)).toContain("Turns in this session: 1");
  });

  test("replay renders teach fork events (not silently dropped)", () => {
    const trace: TraceEvent[] = [
      { type: "session_start", ts: "t", turn: 0, sessionId: "s", cwd: "/x", model: "claude-sonnet-4-6", provider: "anthropic" },
      { type: "user_input", ts: "t", turn: 1, text: "build it" },
      { type: "fork_surfaced", ts: "t", turn: 1, payload: { decision: "storage choice", options: ["SQLite", "JSON file"] } },
      { type: "fork_resolved", ts: "t", turn: 1, payload: { pick: "SQLite", promoted: false } },
      { type: "trivial_logged", ts: "t", turn: 1, payload: { reason: "single sane path" } },
    ];
    const out = renderReplay(trace);
    expect(out).toContain("⑂ FORK storage choice");
    expect(out).toContain("SQLite | JSON file");
    expect(out).toContain("chose: SQLite");
    expect(out).toContain("trivial: single sane path");
  });
});

describe("aborted turn trace consistency", () => {
  test("abort emits turn_aborted so api_request is not an orphan", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "sobr-abort-"));
    const events: TraceEvent[] = [];
    // Signal-aware provider: yields message_start, then throws once aborted.
    const provider = {
      async *stream(_req: unknown, signal?: AbortSignal) {
        yield { type: "message_start", message: { id: "m", model: "claude-sonnet-4-6" } } as never;
        await new Promise((r) => setTimeout(r, 30));
        if (signal?.aborted) throw new DOMException("aborted", "AbortError");
        yield { type: "message_stop" } as never;
      },
    };
    const agent = new Agent({
      provider: provider as never,
      config: DEFAULT_CONFIG,
      system: "s",
      trace: { emit: (ev) => events.push(ev) },
      dispatch: {
        registry: defaultRegistry(),
        policy: new PolicyEngine(),
        teachGate: new TeachOffGate(),
        permission: new PermissionGate(async () => "n"),
        ctx: { cwd },
      },
    });
    const controller = new AbortController();
    const p = agent.runTurn("hang", controller.signal);
    controller.abort();
    await p;
    const types = events.map((e) => e.type);
    expect(types).toContain("api_request");
    expect(types).toContain("turn_aborted");
    expect(types).not.toContain("api_response"); // partial discarded
  });
});
