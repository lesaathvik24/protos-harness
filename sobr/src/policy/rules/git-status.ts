// Session-start advisory ported from hooks/git-status-check.sh — not a per-call
// PolicyRule: it runs once when a session opens and returns warnings to print.

export function gitStatusAdvisory(cwd: string): string[] {
  const run = (cmd: string[]): { ok: boolean; out: string } => {
    const proc = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "ignore" });
    return { ok: proc.exitCode === 0, out: new TextDecoder().decode(proc.stdout).trim() };
  };

  if (!run(["git", "rev-parse", "--git-dir"]).ok) return [];

  const warnings: string[] = [];
  const branch = run(["git", "symbolic-ref", "--short", "HEAD"]);
  if (!branch.ok) warnings.push("WARNING: Repository is in detached HEAD state.");

  const status = run(["git", "status", "--porcelain"]);
  const lines = status.out === "" ? [] : status.out.split("\n");
  const conflicts = lines.filter((l) => /^[UA][UA]/.test(l)).length;
  const modified = lines.filter((l) => /^\s*M/.test(l)).length;
  if (conflicts > 0) warnings.push(`WARNING: ${conflicts} file(s) have merge conflicts.`);
  if (modified > 200) warnings.push(`WARNING: ${modified} modified files — unusually large working tree.`);
  return warnings;
}
