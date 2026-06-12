import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TraceWriter, readTrace } from "../../src/trace/writer.ts";
import { digestOf, sha256Of, type TraceEvent } from "../../src/trace/events.ts";
import { costUsd, fmtUsd } from "../../src/trace/cost.ts";
import { SessionStore, newSessionId } from "../../src/session/store.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-trace-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const usage = { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 2000, cacheWriteTokens: 100 };

describe("trace writer", () => {
  test("JSONL roundtrip preserves events and order", async () => {
    const writer = new TraceWriter(dir);
    const events: TraceEvent[] = [
      { type: "session_start", ts: "t0", turn: 0, sessionId: "s1", cwd: "/x", model: "m", provider: "anthropic" },
      { type: "user_input", ts: "t1", turn: 1, text: "hello" },
      { type: "turn_end", ts: "t2", turn: 1, usage, costUsd: 0.01 },
    ];
    for (const ev of events) writer.emit(ev);
    await writer.flush();
    expect(await readTrace(dir)).toEqual(events);
  });

  test("readTrace of missing file is empty", async () => {
    expect(await readTrace(join(dir, "nope"))).toEqual([]);
  });
});

describe("cost", () => {
  test("sonnet pricing math", () => {
    // 1k in * $3/M + 500 out * $15/M + 2k cacheRead * $0.3/M + 100 cacheWrite * $3.75/M
    const expected = (1000 * 3 + 500 * 15 + 2000 * 0.3 + 100 * 3.75) / 1_000_000;
    expect(costUsd("claude-sonnet-4-6", usage)).toBeCloseTo(expected, 10);
  });

  test("unknown model is null (never guessed), formats as n/a", () => {
    expect(costUsd("deepseek-chat", usage)).toBeNull();
    expect(fmtUsd(null)).toBe("n/a");
  });

  test("fmtUsd switches precision under a cent", () => {
    expect(fmtUsd(0.0042)).toBe("$0.0042");
    expect(fmtUsd(1.5)).toBe("$1.50");
  });
});

describe("digest helpers", () => {
  test("digestOf flattens whitespace and truncates", () => {
    expect(digestOf("a\n  b\t c")).toBe("a b c");
    expect(digestOf("x".repeat(300)).length).toBe(201);
  });

  test("sha256Of is stable", () => {
    expect(sha256Of("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("session store", () => {
  test("create/list/resolve/trace", async () => {
    const store = new SessionStore(dir);
    await store.create({ id: "20260612-100000-aaaa", startedAt: "2026-06-12T10:00:00Z", cwd: "/a", model: "m", provider: "anthropic" });
    await store.create({ id: "20260612-110000-bbbb", startedAt: "2026-06-12T11:00:00Z", cwd: "/b", model: "m", provider: "anthropic" });

    const metas = await store.list();
    expect(metas.map((m) => m.id)).toEqual(["20260612-110000-bbbb", "20260612-100000-aaaa"]); // newest first

    expect(await store.resolve("20260612-11")).toBe("20260612-110000-bbbb");
    await expect(store.resolve("20260612")).rejects.toThrow(/Ambiguous/);
    await expect(store.resolve("nope")).rejects.toThrow(/No session/);

    const writer = new TraceWriter(store.dirOf("20260612-100000-aaaa"));
    writer.emit({ type: "user_input", ts: "t", turn: 1, text: "x" });
    await writer.flush();
    expect(await store.trace("20260612-100000-aaaa")).toHaveLength(1);
  });

  test("newSessionId is sortable and unique-ish", () => {
    const a = newSessionId(new Date("2026-06-12T10:00:00"));
    expect(a).toMatch(/^20260612-100000-[a-z0-9]{4}$/);
  });
});
