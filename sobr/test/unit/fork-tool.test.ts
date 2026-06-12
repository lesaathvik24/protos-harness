import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TeachSession } from "../../src/teach/state.ts";
import { ProfileStore } from "../../src/teach/profile.ts";
import { makeForkTool, makeTrivialTool, type ForkInput, type TeachUi } from "../../src/teach/fork-tool.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-fork-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function setup(opts: { level?: "L1" | "L2" | "L3"; hard?: boolean; pick?: number; justification?: string } = {}) {
  const session = new TeachSession();
  session.activate(opts.level ?? "L2", opts.hard ?? false);
  const profile = new ProfileStore(dir);
  const asked: { decision: string; options: { label: string; what: string }[] }[] = [];
  const traced: string[] = [];
  const ui: TeachUi = {
    askPick: async (req) => {
      asked.push(req);
      return opts.pick ?? 0;
    },
    askText: async () => opts.justification ?? "because it is leaner",
  };
  const deps = { session, profile, ui, trace: (ev: { type: string }) => traced.push(ev.type) };
  return { session, profile, asked, traced, fork: makeForkTool(deps), trivial: makeTrivialTool(deps) };
}

const stackFork: ForkInput = {
  decision: "stack for the web app",
  concept: "fullstack-vs-split",
  stakes: "L1",
  options: [
    { label: "Next + Postgres", what: "server-rendered React, one Node runtime, SQL store" },
    { label: "React + FastAPI", what: "SPA frontend, Python API, you own the session layer" },
    { label: "SvelteKit + SQLite", what: "compiled components, file-based store, single binary deploy" },
  ],
};

const ctx = { cwd: "/tmp" };

describe("fork tool validators (pure, pre-render)", () => {
  test("fewer than 2 options rejected — one sane path is not a fork", async () => {
    const { fork } = setup();
    const out = await fork.run({ ...stackFork, options: stackFork.options.slice(0, 1) }, ctx);
    expect(out.isError).toBe(true);
    expect(out.content).toContain("trivial");
  });

  test("more than 4 options rejected", async () => {
    const { fork } = setup();
    const five = Array.from({ length: 5 }, (_, i) => ({ label: `o${i}`, what: `thing ${i}` }));
    const out = await fork.run({ ...stackFork, options: five }, ctx);
    expect(out.isError).toBe(true);
  });

  test("stakes below active level rejected with trivial guidance", async () => {
    const { fork } = setup({ level: "L1" });
    const out = await fork.run({ ...stackFork, stakes: "L3" }, ctx);
    expect(out.isError).toBe(true);
    expect(out.content).toContain("below the active level L1");
  });

  test("mastered concept rejected — deterministic suppression", async () => {
    const { fork, profile } = setup();
    await profile.recordPick("fullstack-vs-split", 3);
    const out = await fork.run(stackFork, ctx);
    expect(out.isError).toBe(true);
    expect(out.content).toContain('reason "mastered:fullstack-vs-split"');
  });

  test("career framing in an option is rejected (neutrality)", async () => {
    const { fork, traced } = setup();
    const rigged = {
      ...stackFork,
      options: [
        { label: "Next + Postgres", what: "strong hiring signal, most clones use this" },
        { label: "SvelteKit", what: "leaner but fewer employers know it" },
      ],
    };
    const out = await fork.run(rigged, ctx);
    expect(out.isError).toBe(true);
    expect(out.content).toContain("NEUTRALITY BLOCKED");
    expect(traced).toContain("fork_rejected");
  });

  test("teach off: fork is unavailable", async () => {
    const { fork, session } = setup();
    session.deactivate();
    expect((await fork.run(stackFork, ctx)).isError).toBe(true);
  });
});

describe("fork tool happy path (blocks on pick, mints tag, logs, records)", () => {
  test("reveal-mode pick: result names the pick + big-fork map instruction + tags the gate", async () => {
    const { fork, session, asked, traced } = setup({ pick: 2 });
    const out = await fork.run(stackFork, ctx);
    expect(out.isError).toBeUndefined();
    expect(asked).toHaveLength(1); // blocked on the user exactly once
    expect(out.content).toContain("picked option 3: SvelteKit + SQLite");
    expect(out.content).toContain("tradeoff map"); // L1 = big fork
    expect(out.content).toContain("conditioned recommendation");
    expect(session.state.on && session.state.pendingTag).toBe(true);
    expect(traced).toEqual(["fork_surfaced", "fork_resolved"]);
  });

  test("small fork (L2 stakes at L2 level) gets the ≤2-sentence reveal rule", async () => {
    const { fork } = setup();
    const out = await fork.run({ ...stackFork, stakes: "L2", concept: "error-strategy" }, ctx);
    expect(out.content).toContain("≤2 sentences");
    expect(out.content).not.toContain("tradeoff map");
  });

  test("hard mode collects justification and asks the model to check it", async () => {
    const { fork } = setup({ hard: true, justification: "fewer moving parts to operate" });
    const out = await fork.run(stackFork, ctx);
    expect(out.content).toContain('justification: "fewer moving parts to operate"');
    expect(out.content).toContain("correct any misconception");
  });

  test("hard picks weigh double: two hard forks master the concept", async () => {
    const first = setup({ hard: true });
    await first.fork.run(stackFork, ctx);
    const second = setup({ hard: true });
    const out = await second.fork.run(stackFork, ctx);
    expect(out.content).toContain("mastery");
    expect(await second.profile.isMastered("fullstack-vs-split")).toBe(true);
  });

  test("log.md gets the FORK entry in SKILL.md format", async () => {
    const { fork } = setup({ pick: 1 });
    await fork.run(stackFork, ctx);
    const log = await Bun.file(join(dir, "log.md")).text();
    expect(log).toContain("## FORK — stack for the web app");
    expect(log).toContain("- chose: React + FastAPI");
    expect(log).toContain("- options: Next + Postgres | React + FastAPI | SvelteKit + SQLite");
  });
});

describe("trivial tool", () => {
  test("≤5-word reason tags the gate and logs", async () => {
    const { trivial, session } = setup();
    const out = await trivial.run({ reason: "single sane path" }, ctx);
    expect(out.isError).toBeUndefined();
    expect(session.state.on && session.state.pendingTag).toBe(true);
    const log = await Bun.file(join(dir, "log.md")).text();
    expect(log).toContain("- TRIVIAL: single sane path");
  });

  test("6+ words rejected", async () => {
    const { trivial } = setup();
    const out = await trivial.run({ reason: "this reason is way too long honestly" }, ctx);
    expect(out.isError).toBe(true);
  });

  test("empty reason rejected", async () => {
    const { trivial } = setup();
    expect((await trivial.run({ reason: "  " }, ctx)).isError).toBe(true);
  });

  test("mastered shorthand is a valid reason", async () => {
    const { trivial } = setup();
    const out = await trivial.run({ reason: "mastered:sql-vs-nosql" }, ctx);
    expect(out.isError).toBeUndefined();
  });
});
