import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { editTool } from "../../src/tools/edit.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-edit-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const ctx = () => ({ cwd: dir });

async function seed(name: string, content: string) {
  await Bun.write(join(dir, name), content);
}

describe("edit tool", () => {
  test("replaces a unique match", async () => {
    await seed("a.txt", "alpha beta gamma");
    const out = await editTool.run({ path: "a.txt", old_string: "beta", new_string: "BETA" }, ctx());
    expect(out.isError).toBeUndefined();
    expect(await Bun.file(join(dir, "a.txt")).text()).toBe("alpha BETA gamma");
  });

  test("fails on zero matches", async () => {
    await seed("a.txt", "alpha beta");
    const out = await editTool.run({ path: "a.txt", old_string: "nope", new_string: "x" }, ctx());
    expect(out.isError).toBe(true);
    expect(out.content).toContain("No match");
  });

  test("fails on multiple matches without replace_all", async () => {
    await seed("a.txt", "x y x y x");
    const out = await editTool.run({ path: "a.txt", old_string: "x", new_string: "z" }, ctx());
    expect(out.isError).toBe(true);
    expect(out.content).toContain("3 times");
  });

  test("replace_all replaces every occurrence", async () => {
    await seed("a.txt", "x y x y x");
    const out = await editTool.run({ path: "a.txt", old_string: "x", new_string: "z", replace_all: true }, ctx());
    expect(out.isError).toBeUndefined();
    expect(await Bun.file(join(dir, "a.txt")).text()).toBe("z y z y z");
  });

  test("inserts $-sequences in the replacement literally (no String.replace pattern eval)", async () => {
    await seed("a.js", "const p = AMOUNT;");
    await editTool.run({ path: "a.js", old_string: "AMOUNT", new_string: "`$${amount}`" }, ctx());
    expect(await Bun.file(join(dir, "a.js")).text()).toBe("const p = `$${amount}`;");
  });

  test("$& and $1 in replacement are not treated as match references", async () => {
    await seed("b.txt", "X");
    await editTool.run({ path: "b.txt", old_string: "X", new_string: "$& and $1" }, ctx());
    expect(await Bun.file(join(dir, "b.txt")).text()).toBe("$& and $1");
  });

  test("fails on missing file", async () => {
    const out = await editTool.run({ path: "missing.txt", old_string: "a", new_string: "b" }, ctx());
    expect(out.isError).toBe(true);
  });

  test("fails when old and new are identical", async () => {
    await seed("a.txt", "same");
    const out = await editTool.run({ path: "a.txt", old_string: "same", new_string: "same" }, ctx());
    expect(out.isError).toBe(true);
  });
});
