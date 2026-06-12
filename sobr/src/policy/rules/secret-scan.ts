import type { PolicyRule } from "../engine.ts";

// Ported verbatim from hooks/scan-secrets.sh — same patterns, same labels,
// same first-match-wins. Applies to write (content) and edit (new_string).

const PATTERNS: [RegExp, string][] = [
  [/sk-[A-Za-z0-9]{20,}/, "OpenAI/Anthropic key (sk-)"],
  [/AKIA[0-9A-Z]{16}/, "AWS access key (AKIA)"],
  [/ghp_[A-Za-z0-9]{36}/, "GitHub PAT (ghp_)"],
  [/ghs_[A-Za-z0-9]{36}/, "GitHub app token (ghs_)"],
  [/PRIVATE KEY/, "Private key block"],
  [/DATABASE_URL\s*=\s*\S+/, "Database URL"],
  [/password\s*=\s*["']\S{8,}/i, "Hardcoded password"],
  [/secret\s*=\s*["']\S{8,}/i, "Hardcoded secret"],
];

export const secretScanRule: PolicyRule = {
  name: "secret-scan",
  check(call) {
    const content =
      typeof call.input.content === "string"
        ? call.input.content
        : typeof call.input.new_string === "string"
          ? call.input.new_string
          : "";
    if (!content) return { kind: "allow" };
    for (const [pattern, label] of PATTERNS) {
      if (pattern.test(content)) {
        return {
          kind: "deny",
          rule: this.name,
          message: `Secret pattern detected — ${label}. Use an env var or placeholder instead of the literal value.`,
        };
      }
    }
    return { kind: "allow" };
  },
};
