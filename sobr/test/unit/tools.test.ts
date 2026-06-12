import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readTool } from "../../src/tools/read.ts";
import { writeTool } from "../../src/tools/write.ts";
import { bashTool } from "../../src/tools/bash.ts";
import { globTool } from "../../src/tools/glob.ts";
import { grepTool } from "../../src/tools/grep.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-tools-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
const ctx = () => ({ cwd: dir });

describe("read", () => {
  test("numbers lines and respects offset/limit", async () => {
    await Bun.write(join(dir, "f.txt"), "one\ntwo\nthree\nfour");
    const out = await readTool.run({ path: "f.txt", offset: 2, limit: 2 }, ctx());
    expect(out.content).toContain("2\ttwo");
    expect(out.content).toContain("3\tthree");
    expect(out.content).not.toContain("one");
  });

  test("errors on missing file", async () => {
    const out = await readTool.run({ path: "nope.txt" }, ctx());
    expect(out.isError).toBe(true);
  });
});

describe("write", () => {
  test("creates parent directories", async () => {
    const out = await writeTool.run({ path: "deep/nested/f.txt", content: "hi" }, ctx());
    expect(out.isError).toBeUndefined();
    expect(await Bun.file(join(dir, "deep/nested/f.txt")).text()).toBe("hi");
  });
});

describe("bash", () => {
  test("captures stdout", async () => {
    const out = await bashTool.run({ command: "echo hello" }, ctx());
    expect(out.content).toBe("hello");
    expect(out.isError).toBeUndefined();
  });

  test("non-zero exit is an error tool_result, not a throw", async () => {
    const out = await bashTool.run({ command: "echo oops >&2; exit 3" }, ctx());
    expect(out.isError).toBe(true);
    expect(out.content).toContain("oops");
    expect(out.content).toContain("exit code 3");
  });

  test("runs in the tool context cwd", async () => {
    await Bun.write(join(dir, "marker.txt"), "x");
    const out = await bashTool.run({ command: "ls" }, ctx());
    expect(out.content).toContain("marker.txt");
  });

  test("times out long commands", async () => {
    const out = await bashTool.run({ command: "sleep 5", timeout_ms: 150 }, ctx());
    expect(out.isError).toBe(true);
    expect(out.content).toContain("timed out");
  });
});

describe("glob", () => {
  test("matches pattern, skips node_modules", async () => {
    await Bun.write(join(dir, "a.ts"), "");
    await Bun.write(join(dir, "src/b.ts"), "");
    await mkdir(join(dir, "node_modules/pkg"), { recursive: true });
    await Bun.write(join(dir, "node_modules/pkg/c.ts"), "");
    const out = await globTool.run({ pattern: "**/*.ts" }, ctx());
    expect(out.content).toContain("a.ts");
    expect(out.content).toContain("src/b.ts");
    expect(out.content).not.toContain("node_modules");
  });
});

describe("grep", () => {
  test("returns file:line:text matches", async () => {
    await Bun.write(join(dir, "x.txt"), "nothing\nTODO: fix\nmore");
    const out = await grepTool.run({ pattern: "TODO" }, ctx());
    expect(out.content).toContain("x.txt:2:TODO: fix");
  });

  test("invalid regex is an error result", async () => {
    const out = await grepTool.run({ pattern: "([" }, ctx());
    expect(out.isError).toBe(true);
  });

  test("glob filter narrows files", async () => {
    await Bun.write(join(dir, "a.ts"), "TODO");
    await Bun.write(join(dir, "a.md"), "TODO");
    const out = await grepTool.run({ pattern: "TODO", glob: "*.ts" }, ctx());
    expect(out.content).toContain("a.ts");
    expect(out.content).not.toContain("a.md");
  });
});

describe("registry", () => {
  test("default registry has all six tools with wire specs", () => {
    const reg = defaultRegistry();
    const names = reg.specs().map((s) => s.name);
    expect(names.sort()).toEqual(["bash", "edit", "glob", "grep", "read", "write"]);
    for (const spec of reg.specs()) {
      expect(spec.input_schema).toHaveProperty("type", "object");
      expect(spec.description.length).toBeGreaterThan(10);
    }
  });

  test("mutability split matches plan (read/glob/grep allow, write/edit/bash ask)", () => {
    const reg = defaultRegistry();
    expect(reg.get("read")!.mutates).toBe(false);
    expect(reg.get("glob")!.mutates).toBe(false);
    expect(reg.get("grep")!.mutates).toBe(false);
    expect(reg.get("write")!.mutates).toBe(true);
    expect(reg.get("edit")!.mutates).toBe(true);
    expect(reg.get("bash")!.mutates).toBe(true);
  });
});
