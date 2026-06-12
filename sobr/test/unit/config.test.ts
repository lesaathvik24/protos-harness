import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, DEFAULT_CONFIG, mergeConfigLayer } from "../../src/config/config.ts";

let cwd: string;
let home: string;
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "sobr-cfg-cwd-"));
  home = await mkdtemp(join(tmpdir(), "sobr-cfg-home-"));
});
afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});

describe("config", () => {
  test("defaults when no files exist", async () => {
    const cfg = await loadConfig(cwd, home);
    expect(cfg).toEqual(DEFAULT_CONFIG);
    expect(cfg.model).toBe("claude-sonnet-4-6");
  });

  test("global layer applies, project layer wins", async () => {
    await mkdir(join(home, ".sobr"), { recursive: true });
    await Bun.write(join(home, ".sobr", "config.json"), JSON.stringify({ model: "global-model", maxTokens: 1000 }));
    await Bun.write(join(cwd, ".sobr.json"), JSON.stringify({ model: "project-model" }));
    const cfg = await loadConfig(cwd, home);
    expect(cfg.model).toBe("project-model");
    expect(cfg.maxTokens).toBe(1000);
  });

  test("unknown key fails loud with the source path", async () => {
    await Bun.write(join(cwd, ".sobr.json"), JSON.stringify({ modle: "typo" }));
    await expect(loadConfig(cwd, home)).rejects.toThrow(/Unknown config key "modle".*\.sobr\.json/);
  });

  test("invalid JSON fails loud", async () => {
    await Bun.write(join(cwd, ".sobr.json"), "{not json");
    await expect(loadConfig(cwd, home)).rejects.toThrow(/Invalid JSON/);
  });

  test("mergeConfigLayer is pure", () => {
    const merged = mergeConfigLayer(DEFAULT_CONFIG, { maxTokens: 42 }, "test");
    expect(merged.maxTokens).toBe(42);
    expect(DEFAULT_CONFIG.maxTokens).not.toBe(42);
  });
});
