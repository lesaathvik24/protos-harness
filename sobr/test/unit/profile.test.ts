import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProfileStore, MASTERY_THRESHOLD } from "../../src/teach/profile.ts";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sobr-profile-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("learner profile (pick-count promotion — deterministic code, not behavioral hope)", () => {
  test("3 confident picks promote to mastered", async () => {
    const store = new ProfileStore(dir);
    expect((await store.recordPick("sql-vs-nosql")).status).toBe("learning");
    expect((await store.recordPick("sql-vs-nosql")).status).toBe("learning");
    const third = await store.recordPick("sql-vs-nosql");
    expect(third.status).toBe("mastered");
    expect(third.confidentPicks).toBe(MASTERY_THRESHOLD);
    expect(await store.isMastered("sql-vs-nosql")).toBe(true);
  });

  test("hard-mode picks weigh double (justification > reveal pick)", async () => {
    const store = new ProfileStore(dir);
    await store.recordPick("async-vs-sync", 2);
    const second = await store.recordPick("async-vs-sync", 2);
    expect(second.status).toBe("mastered"); // 2+2 ≥ 3
  });

  test("persists across store instances (cross-session)", async () => {
    await new ProfileStore(dir).recordPick("rest-vs-grpc", 3);
    expect(await new ProfileStore(dir).isMastered("rest-vs-grpc")).toBe(true);
  });

  test("fumble marks shaky", async () => {
    const store = new ProfileStore(dir);
    await store.recordPick("monolith-vs-microservices");
    const rec = await store.recordFumble("monolith-vs-microservices");
    expect(rec.status).toBe("shaky");
    expect(rec.fumbles).toBe(1);
  });

  test("render groups by status in SKILL.md shape", async () => {
    const store = new ProfileStore(dir);
    await store.recordPick("a-vs-b", 3);
    await store.recordPick("c-vs-d", 1);
    await store.recordFumble("e-vs-f");
    const out = store.render(await store.load());
    expect(out).toContain("## mastered\n- a-vs-b — 3 confident pick(s)");
    expect(out).toContain("## learning\n- c-vs-d — 1 confident pick(s)");
    expect(out).toContain("## shaky\n- e-vs-f — fumbled 1x");
  });

  test("log.md gets the header once and appends", async () => {
    const store = new ProfileStore(dir);
    await store.appendLog("- TRIVIAL: config rename\n");
    await store.appendLog("- TRIVIAL: another\n");
    const log = await Bun.file(join(dir, "log.md")).text();
    expect(log).toStartWith("# sobr teach decision log");
    expect(log.match(/# sobr teach decision log/g)).toHaveLength(1);
    expect(log).toContain("- TRIVIAL: config rename\n- TRIVIAL: another\n");
  });

  test("empty profile renders a friendly placeholder", async () => {
    const store = new ProfileStore(dir);
    expect(store.render(await store.load())).toContain("empty");
  });

  test("concurrent recordPick calls do not lose updates (serialized)", async () => {
    const store = new ProfileStore(dir);
    // fire 5 picks for the same concept without awaiting between them
    await Promise.all(Array.from({ length: 5 }, () => store.recordPick("race-concept")));
    const profile = await store.load();
    expect(profile.concepts["race-concept"]!.confidentPicks).toBe(5); // not <5 from clobbering
    expect(profile.concepts["race-concept"]!.status).toBe("mastered");
  });

  test("concurrent appendLog calls all land", async () => {
    const store = new ProfileStore(dir);
    await Promise.all(Array.from({ length: 4 }, (_, i) => store.appendLog(`- TRIVIAL: r${i}\n`)));
    const log = await Bun.file(join(dir, "log.md")).text();
    for (let i = 0; i < 4; i++) expect(log).toContain(`- TRIVIAL: r${i}`);
  });
});
