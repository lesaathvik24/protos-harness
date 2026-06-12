import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { PolicyEngine, type PolicyRule } from "../../src/policy/engine.ts";
import {
  secretScanRule,
  dangerousCommandRule,
  conventionalCommitRule,
  dependencyAuditRule,
  defaultRules,
} from "../../src/policy/rules/index.ts";
import { extractCommitMessage } from "../../src/policy/rules/conventional-commit.ts";
import type { ToolCall } from "../../src/tools/types.ts";

// The original hook fixtures (repo root tests/fixtures/**) drive these table
// tests — single source of truth, ported semantics verified against the very
// inputs the bash hooks were tested with.
const FIXTURES = new URL("../../../tests/fixtures/", import.meta.url).pathname;

async function fixtureTable(dir: string): Promise<{ name: string; input: Record<string, unknown>; shouldBlock: boolean }[]> {
  const files = (await readdir(join(FIXTURES, dir))).filter((f) => f.endsWith(".json"));
  const rows = [];
  for (const f of files) {
    rows.push({
      name: f,
      input: JSON.parse(await Bun.file(join(FIXTURES, dir, f)).text()),
      shouldBlock: f.startsWith("block-"),
    });
  }
  return rows;
}

function call(name: string, input: Record<string, unknown>): ToolCall {
  return { id: "t1", name, input };
}

describe("secret-scan rule (fixtures from tests/fixtures/scan-secrets)", async () => {
  for (const row of await fixtureTable("scan-secrets")) {
    test(`${row.name} → ${row.shouldBlock ? "deny" : "allow"}`, () => {
      const verdict = secretScanRule.check(call("write", row.input));
      expect(verdict.kind).toBe(row.shouldBlock ? "deny" : "allow");
    });
  }

  test("also scans edit new_string", () => {
    const verdict = secretScanRule.check(call("edit", { new_string: "key = AKIAIOSFODNN7EXAMPLE" }));
    expect(verdict.kind).toBe("deny");
    if (verdict.kind === "deny") expect(verdict.message).toContain("AWS access key");
  });

  test("PRIVATE KEY block detected", () => {
    expect(secretScanRule.check(call("write", { content: "-----BEGIN PRIVATE KEY-----" })).kind).toBe("deny");
  });
});

describe("dangerous-command rule (fixtures from tests/fixtures/dangerous-command)", async () => {
  for (const row of await fixtureTable("dangerous-command")) {
    test(`${row.name} → ${row.shouldBlock ? "deny" : "allow"}`, () => {
      const verdict = dangerousCommandRule.check(call("bash", row.input));
      expect(verdict.kind).toBe(row.shouldBlock ? "deny" : "allow");
    });
  }

  test("only applies to bash", () => {
    expect(dangerousCommandRule.check(call("write", { content: "rm -rf /" })).kind).toBe("allow");
  });
});

describe("conventional-commit rule (fixtures from tests/fixtures/commit-message)", async () => {
  for (const row of await fixtureTable("commit-message")) {
    test(`${row.name} → ${row.shouldBlock ? "deny" : "allow"}`, () => {
      const verdict = conventionalCommitRule.check(call("bash", row.input));
      expect(verdict.kind).toBe(row.shouldBlock ? "deny" : "allow");
    });
  }

  test("non-commit git commands pass", () => {
    expect(conventionalCommitRule.check(call("bash", { command: "git status" })).kind).toBe("allow");
  });

  test("commit without -m passes (editor flow)", () => {
    expect(conventionalCommitRule.check(call("bash", { command: "git commit" })).kind).toBe("allow");
  });

  test("scope and breaking-change marker accepted", () => {
    expect(conventionalCommitRule.check(call("bash", { command: 'git commit -m "feat(api)!: v2"' })).kind).toBe("allow");
  });

  test("extractCommitMessage handles quoted and bare forms", () => {
    expect(extractCommitMessage('git commit -m "feat: x y"')).toBe("feat: x y");
    expect(extractCommitMessage("git commit -m wip")).toBe("wip");
    expect(extractCommitMessage("git commit")).toBeNull();
  });
});

describe("dependency-audit rule (warn, no subprocess)", () => {
  test("npm install warns", () => {
    const verdict = dependencyAuditRule.check(call("bash", { command: "npm install left-pad" }));
    expect(verdict.kind).toBe("warn");
  });

  test("pip install warns", () => {
    expect(dependencyAuditRule.check(call("bash", { command: "pip install requests" })).kind).toBe("warn");
  });

  test("plain npm run does not warn", () => {
    expect(dependencyAuditRule.check(call("bash", { command: "npm run build" })).kind).toBe("allow");
  });
});

describe("policy engine", () => {
  test("deny wins over warn regardless of rule order", () => {
    const warnFirst: PolicyRule = { name: "w", check: () => ({ kind: "warn", rule: "w", message: "warn" }) };
    const denyAfter: PolicyRule = { name: "d", check: () => ({ kind: "deny", rule: "d", message: "deny" }) };
    const engine = new PolicyEngine([warnFirst, denyAfter]);
    expect(engine.check(call("bash", {})).kind).toBe("deny");
  });

  test("default rules: dangerous npm install both warns and would deny if dangerous", () => {
    const engine = new PolicyEngine(defaultRules());
    expect(engine.check(call("bash", { command: "npm install x && rm -rf /" })).kind).toBe("deny");
    expect(engine.check(call("bash", { command: "npm install x" })).kind).toBe("warn");
    expect(engine.check(call("bash", { command: "ls" })).kind).toBe("allow");
  });
});
