import type { ToolCall } from "../tools/types.ts";

// Week-2 fills rules/ with the five ported builtins (secret-scan, dangerous-command,
// conventional-commit, dependency-audit, git-status advisory). The engine shape and
// Verdict union are final now so dispatch doesn't change.

export type Verdict =
  | { kind: "allow" }
  | { kind: "warn"; rule: string; message: string }
  | { kind: "deny"; rule: string; message: string };

export interface PolicyRule {
  name: string;
  check(call: ToolCall): Verdict;
}

export class PolicyEngine {
  constructor(private rules: PolicyRule[] = []) {}

  check(call: ToolCall): Verdict {
    for (const rule of this.rules) {
      const verdict = rule.check(call);
      if (verdict.kind !== "allow") return verdict;
    }
    return { kind: "allow" };
  }
}
