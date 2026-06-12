import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitStatusAdvisory } from "../../src/policy/rules/git-status.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-git-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function git(args: string[], cwd: string) {
  const proc = Bun.spawnSync(["git", ...args], { cwd, stdout: "ignore", stderr: "ignore" });
  if (proc.exitCode !== 0) throw new Error(`git ${args.join(" ")} failed`);
}

describe("git-status session advisory (warn, non-blocking)", () => {
  test("non-repo: silent", () => {
    expect(gitStatusAdvisory(dir)).toEqual([]);
  });

  test("clean repo on a branch: silent", () => {
    git(["init", "-q", "-b", "main"], dir);
    expect(gitStatusAdvisory(dir)).toEqual([]);
  });

  test("detached HEAD warns", async () => {
    git(["init", "-q", "-b", "main"], dir);
    git(["-c", "user.email=t@t", "-c", "user.name=t", "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "init"], dir);
    git(["checkout", "-q", "--detach"], dir);
    const warnings = gitStatusAdvisory(dir);
    expect(warnings.some((w) => w.includes("detached HEAD"))).toBe(true);
  });
});
