import { describe, expect, test } from "bun:test";
import { PermissionGate, bashPrefixOf, type PermAnswer, type PermRequest } from "../../src/permission/gate.ts";
import { readTool } from "../../src/tools/read.ts";
import { writeTool } from "../../src/tools/write.ts";
import { bashTool } from "../../src/tools/bash.ts";

function scripted(answers: PermAnswer[]) {
  const asked: PermRequest[] = [];
  let i = 0;
  const prompter = async (req: PermRequest) => {
    asked.push(req);
    const a = answers[i++];
    if (a === undefined) throw new Error("prompter called more times than scripted");
    return a;
  };
  return { prompter, asked };
}

describe("permission gate", () => {
  test("read-only tools never prompt", async () => {
    const { prompter, asked } = scripted([]);
    const gate = new PermissionGate(prompter);
    const d = await gate.check(readTool, { path: "x" });
    expect(d.behavior).toBe("allow");
    expect(asked).toHaveLength(0);
  });

  test("y allows once — prompts again next time", async () => {
    const { prompter, asked } = scripted(["y", "y"]);
    const gate = new PermissionGate(prompter);
    expect((await gate.check(writeTool, { path: "a" })).behavior).toBe("allow");
    expect((await gate.check(writeTool, { path: "b" })).behavior).toBe("allow");
    expect(asked).toHaveLength(2);
  });

  test("a grants the tool for the session", async () => {
    const { prompter, asked } = scripted(["a"]);
    const gate = new PermissionGate(prompter);
    expect((await gate.check(writeTool, { path: "a" })).behavior).toBe("allow");
    expect((await gate.check(writeTool, { path: "b" })).behavior).toBe("allow");
    expect(asked).toHaveLength(1);
  });

  test("n denies with a message the model can act on", async () => {
    const { prompter } = scripted(["n"]);
    const gate = new PermissionGate(prompter);
    const d = await gate.check(writeTool, { path: "a" });
    expect(d.behavior).toBe("deny");
    if (d.behavior === "deny") expect(d.message).toContain("denied");
  });

  test("p grants a bash prefix for the session", async () => {
    const { prompter, asked } = scripted(["p"]);
    const gate = new PermissionGate(prompter);
    expect((await gate.check(bashTool, { command: "git status" })).behavior).toBe("allow");
    // same prefix → no prompt
    expect((await gate.check(bashTool, { command: "git status --short" })).behavior).toBe("allow");
    expect(asked).toHaveLength(1);
    expect(asked[0]!.bashPrefix).toBe("git status");
  });

  test("different bash prefix still prompts", async () => {
    const { prompter, asked } = scripted(["p", "n"]);
    const gate = new PermissionGate(prompter);
    await gate.check(bashTool, { command: "git status" });
    const d = await gate.check(bashTool, { command: "rm -rf /tmp/x" });
    expect(d.behavior).toBe("deny");
    expect(asked).toHaveLength(2);
  });

  test("prefix grant does not match partial-token prefixes", async () => {
    const { prompter, asked } = scripted(["p", "y"]);
    const gate = new PermissionGate(prompter);
    await gate.check(bashTool, { command: "git st" }); // grants "git st"
    await gate.check(bashTool, { command: "git stash" }); // must NOT match "git st"
    expect(asked).toHaveLength(2);
  });

  test("non-bash tools never get a bashPrefix in the prompt", async () => {
    const { prompter, asked } = scripted(["y"]);
    const gate = new PermissionGate(prompter);
    await gate.check(writeTool, { path: "a" });
    expect(asked[0]!.bashPrefix).toBeUndefined();
  });

  test("bashPrefixOf takes the first two tokens", () => {
    expect(bashPrefixOf("git status --short")).toBe("git status");
    expect(bashPrefixOf("ls")).toBe("ls");
    expect(bashPrefixOf("  npm   run build  ")).toBe("npm run");
  });
});
