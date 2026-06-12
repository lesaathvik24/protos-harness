import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "../../src/loop/agent.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";
import { PolicyEngine } from "../../src/policy/engine.ts";
import { defaultRules } from "../../src/policy/rules/index.ts";
import { PermissionGate } from "../../src/permission/gate.ts";
import { DEFAULT_CONFIG } from "../../src/config/config.ts";
import { FakeAnthropic, loadFixture } from "../helpers/fake.ts";
import type { StreamEvent } from "../../src/provider/types.ts";
import { TeachSession } from "../../src/teach/state.ts";
import { TeachWriteGate, GATED_MESSAGE } from "../../src/teach/gate.ts";
import { TeachController } from "../../src/teach/controller.ts";
import { ProfileStore } from "../../src/teach/profile.ts";
import type { TeachUi } from "../../src/teach/fork-tool.ts";

let cwd: string;
let profileDir: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "sobr-teach-loop-"));
  profileDir = await mkdtemp(join(tmpdir(), "sobr-teach-prof-"));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
  await rm(profileDir, { recursive: true, force: true });
});

/** One assistant message that calls the given tools, then stops on tool_use. */
function toolTurn(calls: { id: string; name: string; input: Record<string, unknown> }[]): StreamEvent[] {
  const events: StreamEvent[] = [{ type: "message_start", message: { id: "m", model: "claude-sonnet-4-6" } }];
  calls.forEach((c, i) => {
    events.push(
      { type: "content_block_start", index: i, content_block: { type: "tool_use", id: c.id, name: c.name } },
      { type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(c.input) } },
      { type: "content_block_stop", index: i },
    );
  });
  events.push(
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 10 } },
    { type: "message_stop" },
  );
  return events;
}

function makeTeachAgent(scripts: StreamEvent[][], opts: { pick?: number; hard?: boolean } = {}) {
  const provider = new FakeAnthropic(scripts);
  const teachSession = new TeachSession();
  const asked: unknown[] = [];
  const ui: TeachUi = {
    askPick: async (req) => {
      asked.push(req);
      return opts.pick ?? 0;
    },
    askText: async () => "it has fewer moving parts",
  };
  const agent = new Agent({
    provider,
    config: DEFAULT_CONFIG,
    system: "base system",
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(defaultRules()),
      teachGate: new TeachWriteGate(teachSession),
      permission: new PermissionGate(async () => "a"), // permission always granted; we test the TEACH gate
      ctx: { cwd },
    },
  });
  const profile = new ProfileStore(profileDir);
  const controller = new TeachController(agent, profile, ui, teachSession);
  return { agent, provider, controller, profile, asked };
}

const FORK_INPUT = {
  decision: "storage for the todo app",
  concept: "sql-vs-file",
  stakes: "L1",
  options: [
    { label: "SQLite", what: "single-file SQL database, schema + queries" },
    { label: "JSON file", what: "one flat file, app-managed structure" },
  ],
};

describe("teach loop on FakeAnthropic (week-3 core behaviors)", () => {
  test("gate-block → trivial → retry: model self-corrects in-turn", async () => {
    const scripts = [
      // 1: model tries to write without classifying → GATED
      toolTurn([{ id: "w1", name: "write", input: { path: "a.txt", content: "v1" } }]),
      // 2: model self-corrects: trivial then the same write (sequential in one message)
      toolTurn([
        { id: "tr1", name: "trivial", input: { reason: "single sane path" } },
        { id: "w2", name: "write", input: { path: "a.txt", content: "v1" } },
      ]),
      await loadFixture("final-answer"),
    ];
    const { agent, controller, provider } = makeTeachAgent(scripts);
    controller.activate("L2", false);
    await agent.runTurn("create a.txt");

    // the GATED error entered history as is_error
    const firstResults = provider.requests[1]!.messages.at(-1)!.content;
    expect(firstResults[0]).toMatchObject({ type: "tool_result", is_error: true });
    expect((firstResults[0] as { content: string }).content).toBe(GATED_MESSAGE);

    // after trivial, the write succeeded (tag consumed by the very next edit)
    const secondResults = provider.requests[2]!.messages.at(-1)!.content;
    expect(secondResults).toHaveLength(2);
    expect(secondResults[0]).toMatchObject({ type: "tool_result", is_error: undefined });
    expect(secondResults[1]).toMatchObject({ type: "tool_result", is_error: undefined });
    expect(await Bun.file(join(cwd, "a.txt")).text()).toBe("v1");
  });

  test("fork blocks on the user pick, resumes with it, and the gated edit passes", async () => {
    const scripts = [
      toolTurn([{ id: "f1", name: "fork", input: FORK_INPUT }]),
      toolTurn([{ id: "w1", name: "write", input: { path: "store.ts", content: "// sqlite" } }]),
      await loadFixture("final-answer"),
    ];
    const { agent, controller, provider, asked } = makeTeachAgent(scripts, { pick: 0 });
    controller.activate("L2", false);
    await agent.runTurn("build the todo app");

    expect(asked).toHaveLength(1); // loop genuinely blocked on the user
    const forkResult = provider.requests[1]!.messages.at(-1)!.content[0] as { content: string };
    expect(forkResult.content).toContain("picked option 1: SQLite");
    expect(forkResult.content).toContain("tradeoff map"); // L1 = big fork reveal rule
    // the post-fork write passed the gate without further ceremony
    const writeResult = provider.requests[2]!.messages.at(-1)!.content[0];
    expect(writeResult).toMatchObject({ type: "tool_result", is_error: undefined });
    expect(await Bun.file(join(cwd, "store.ts")).exists()).toBe(true);
  });

  test("hard mode: justification flows into the fork result", async () => {
    const scripts = [toolTurn([{ id: "f1", name: "fork", input: FORK_INPUT }]), await loadFixture("final-answer")];
    const { agent, controller, provider } = makeTeachAgent(scripts, { pick: 1, hard: true });
    controller.activate("L2", true);
    await agent.runTurn("build it");
    const forkResult = provider.requests[1]!.messages.at(-1)!.content[0] as { content: string };
    expect(forkResult.content).toContain('justification: "it has fewer moving parts"');
  });

  test("mastered suppression is deterministic: fork on a mastered concept is rejected with trivial guidance", async () => {
    const scripts = [
      toolTurn([{ id: "f1", name: "fork", input: FORK_INPUT }]),
      // model obeys the rejection: trivial mastered:<c> + write
      toolTurn([
        { id: "tr1", name: "trivial", input: { reason: "mastered:sql-vs-file" } },
        { id: "w1", name: "write", input: { path: "store.ts", content: "// sqlite" } },
      ]),
      await loadFixture("final-answer"),
    ];
    const { agent, controller, profile, provider, asked } = makeTeachAgent(scripts);
    await profile.recordPick("sql-vs-file", 3); // session 1 mastered it
    controller.activate("L2", false);
    await agent.runTurn("build the todo app again");

    expect(asked).toHaveLength(0); // user never interrupted — suppression is code, not hope
    const rejection = provider.requests[1]!.messages.at(-1)!.content[0] as { content: string; is_error?: boolean };
    expect(rejection.is_error).toBe(true);
    expect(rejection.content).toContain("mastered:sql-vs-file");
    expect(await Bun.file(join(cwd, "store.ts")).exists()).toBe(true);
  });

  test("teach off: fork/trivial not in the registry, writes ungated", async () => {
    const scripts = [
      toolTurn([{ id: "w1", name: "write", input: { path: "free.txt", content: "x" } }]),
      await loadFixture("final-answer"),
    ];
    const { agent, controller, provider } = makeTeachAgent(scripts);
    controller.activate("L2", false);
    controller.deactivate();
    await agent.runTurn("write freely");
    expect(provider.requests[0]!.tools.map((t) => t.name)).not.toContain("fork");
    const result = provider.requests[1]!.messages.at(-1)!.content[0];
    expect(result).toMatchObject({ type: "tool_result", is_error: undefined });
  });
});

describe("/teach controller", () => {
  test("on injects fork/trivial + teach prompt; off restores", async () => {
    const { agent, controller } = makeTeachAgent([]);
    expect((await controller.handle("on L3 hard")).toLowerCase()).toContain("l3 hard");
    expect(agent.deps.dispatch.registry.get("fork")).toBeDefined();
    expect(agent.deps.dispatch.registry.get("trivial")).toBeDefined();
    expect(agent.deps.system).toContain("TEACH MODE ACTIVE — L3 · HARD");
    expect(agent.deps.system).toStartWith("base system");

    await controller.handle("off");
    expect(agent.deps.dispatch.registry.get("fork")).toBeUndefined();
    expect(agent.deps.system).toBe("base system");
  });

  test("defaults to L2 reveal; rejects junk levels; usage on nonsense", async () => {
    const { controller } = makeTeachAgent([]);
    expect(await controller.handle("on")).toContain("L2");
    expect(await controller.handle("on L9")).toContain("unknown level");
    expect(await controller.handle("wat")).toContain("usage:");
  });

  test("profile prints the learner model", async () => {
    const { controller, profile } = makeTeachAgent([]);
    await profile.recordPick("sql-vs-file", 3);
    const out = await controller.handle("profile");
    expect(out).toContain("## mastered");
    expect(out).toContain("sql-vs-file");
  });
});
