import type { PolicyRule } from "../engine.ts";

// Ported verbatim from hooks/commit-message-guard.sh: only inspects
// `git commit` commands; extracts the -m message; quoted match first, then bare
// word; no -m message (e.g. editor commit) passes.

const PREFIX = /^(feat|fix|refactor|docs|test|chore|style|perf|ci|build|revert)(\(.+\))?!?:/;

export function extractCommitMessage(command: string): string | null {
  const quoted = command.match(/-m\s+["'](.*?)["']/s);
  if (quoted) return quoted[1]!;
  const bare = command.match(/-m\s+(\S+)/);
  if (bare) return bare[1]!;
  return null;
}

export const conventionalCommitRule: PolicyRule = {
  name: "conventional-commit",
  check(call) {
    if (call.name !== "bash") return { kind: "allow" };
    const command = typeof call.input.command === "string" ? call.input.command : "";
    if (!command.includes("git commit")) return { kind: "allow" };
    const msg = extractCommitMessage(command);
    if (!msg) return { kind: "allow" };
    if (PREFIX.test(msg.trim())) return { kind: "allow" };
    return {
      kind: "deny",
      rule: this.name,
      message: `Commit message must use a Conventional Commits prefix (feat|fix|refactor|docs|test|chore|style|perf|ci|build|revert). Got: "${msg}"`,
    };
  },
};
