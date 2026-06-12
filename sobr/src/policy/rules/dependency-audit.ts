import type { PolicyRule } from "../engine.ts";

// From hooks/dependency-audit.sh, minus the subprocess (plan.md: warn-only,
// no subprocess in v1). Reminds rather than runs.

export const dependencyAuditRule: PolicyRule = {
  name: "dependency-audit",
  check(call) {
    if (call.name !== "bash") return { kind: "allow" };
    const command = typeof call.input.command === "string" ? call.input.command : "";
    if (/\bnpm (install|i|add)\b/.test(command)) {
      return { kind: "warn", rule: this.name, message: "Installing npm packages — run `npm audit --audit-level=high` after." };
    }
    if (/\bpip install\b/.test(command)) {
      return { kind: "warn", rule: this.name, message: "Installing pip packages — run `pip-audit` after." };
    }
    return { kind: "allow" };
  },
};
