import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dispatchToolCall, type DispatchDeps } from "../../src/loop/dispatch.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";
import { PolicyEngine, type PolicyRule } from "../../src/policy/engine.ts";
import { TeachOffGate, type TeachGate } from "../../src/teach/gate.ts";
import { PermissionGate, type PermAnswer } from "../../src/permission/gate.ts";

async function makeDeps(opts: { answers?: PermAnswer[]; rules?: PolicyRule[]; teachGate?: TeachGate } = {}) {
  const cwd = await mkdtemp(join(tmpdir(), "sobr-dispatch-"));
  let i = 0;
  const warns: string[] = [];
  const deps: DispatchDeps = {
    registry: defaultRegistry(),
    policy: new PolicyEngine(opts.rules ?? []),
    teachGate: opts.teachGate ?? new TeachOffGate(),
    permission: new PermissionGate(async () => opts.answers?.[i++] ?? "n"),
    ctx: { cwd },
    onWarn: (rule, message) => warns.push(`${rule}:${message}`),
  };
  return { deps, cwd, warns };
}

describe("dispatch pipeline (policy → teach-gate → permission → execute)", () => {
  test("unknown tool is an is_error tool_result", async () => {
    const { deps } = await makeDeps();
    const r = await dispatchToolCall({ id: "t1", name: "nope", input: {} }, deps);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("Unknown tool");
    expect(r.tool_use_id).toBe("t1");
  });

  test("policy deny short-circuits before permission/execute", async () => {
    const denyAll: PolicyRule = { name: "deny-writes", check: () => ({ kind: "deny", rule: "deny-writes", message: "nope" }) };
    const { deps, cwd } = await makeDeps({ rules: [denyAll], answers: ["y"] });
    const r = await dispatchToolCall({ id: "t1", name: "write", input: { path: "f.txt", content: "x" } }, deps);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("POLICY DENIED [deny-writes]");
    expect(await Bun.file(join(cwd, "f.txt")).exists()).toBe(false);
  });

  test("policy warn proceeds but reports", async () => {
    const warnRule: PolicyRule = { name: "advisory", check: () => ({ kind: "warn", rule: "advisory", message: "careful" }) };
    const { deps, warns } = await makeDeps({ rules: [warnRule], answers: ["y"] });
    const r = await dispatchToolCall({ id: "t1", name: "write", input: { path: "f.txt", content: "x" } }, deps);
    expect(r.is_error).toBeUndefined();
    expect(warns).toEqual(["advisory:careful"]);
  });

  test("teach gate block is an is_error tool_result (recovery prompt seam)", async () => {
    const gated: TeachGate = { check: () => ({ allowed: false, message: "GATED: classify first — fork or trivial, then retry." }) };
    const { deps } = await makeDeps({ teachGate: gated, answers: ["y"] });
    const r = await dispatchToolCall({ id: "t1", name: "write", input: { path: "f.txt", content: "x" } }, deps);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("GATED");
  });

  test("permission deny is an is_error tool_result", async () => {
    const { deps, cwd } = await makeDeps({ answers: ["n"] });
    const r = await dispatchToolCall({ id: "t1", name: "write", input: { path: "f.txt", content: "x" } }, deps);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("denied");
    expect(await Bun.file(join(cwd, "f.txt")).exists()).toBe(false);
  });

  test("allowed mutating call executes", async () => {
    const { deps, cwd } = await makeDeps({ answers: ["y"] });
    const r = await dispatchToolCall({ id: "t1", name: "write", input: { path: "f.txt", content: "hi" } }, deps);
    expect(r.is_error).toBeUndefined();
    expect(await Bun.file(join(cwd, "f.txt")).text()).toBe("hi");
  });

  test("tool runtime failure (missing file) is an is_error result, never a throw", async () => {
    const { deps } = await makeDeps();
    const r = await dispatchToolCall({ id: "t1", name: "read", input: { path: "missing.txt" } }, deps);
    expect(r.is_error).toBe(true);
    expect(r.content).toContain("not found");
  });
});
