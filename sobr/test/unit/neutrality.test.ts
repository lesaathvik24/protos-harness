import { describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { checkNeutrality } from "../../src/teach/neutrality.ts";

// Driven by the ORIGINAL hook fixtures (tests/fixtures/vibezombie-neutrality).
// The session-scoping fixtures (pass-inactive / pass-othersession) tested the
// bash hook's session dirs — in-runtime that's TeachState being off, covered in
// fork-tool tests — so here they assert the regex layer alone.
const FIXTURES = new URL("../../../tests/fixtures/vibezombie-neutrality/", import.meta.url).pathname;

function textsOf(payload: { questions?: { question?: string; options?: { label?: string; description?: string }[] }[] }): string[] {
  const texts: string[] = [];
  for (const q of payload.questions ?? []) {
    texts.push(q.question ?? "");
    for (const o of q.options ?? []) {
      texts.push(o.label ?? "", o.description ?? "");
    }
  }
  return texts;
}

describe("neutrality validator (regexes ported verbatim)", async () => {
  const files = (await readdir(FIXTURES)).filter((f) => f.endsWith(".json"));
  for (const f of files) {
    const payload = JSON.parse(await Bun.file(join(FIXTURES, f)).text());
    const hit = checkNeutrality(textsOf(payload));
    if (f === "pass-neutral.json") {
      test(`${f} → clean`, () => expect(hit).toBeNull());
    } else if (f.startsWith("block-")) {
      const kind = f.includes("career") ? "career" : "popularity";
      test(`${f} → ${kind} framing`, () => expect(hit).toStartWith(`${kind} framing:`));
    } else {
      // pass-inactive / pass-othersession contain contaminated text by design —
      // the pure validator flags it; the runtime skips the check when teach is off.
      test(`${f} → contaminated text caught by the pure layer`, () => expect(hit).not.toBeNull());
    }
  }

  test("specific career phrases", () => {
    expect(checkNeutrality(["aligns with your ML background"])).toContain("career framing");
    expect(checkNeutrality(["strong hiring signal"])).toContain("career framing");
    expect(checkNeutrality(["recruiters love this"])).toContain("career framing");
  });

  test("specific popularity phrases", () => {
    expect(checkNeutrality(["the industry-standard pick"])).toContain("popularity framing");
    expect(checkNeutrality(["it's the go-to framework"])).toContain("popularity framing");
    expect(checkNeutrality(["widely used in production"])).toContain("popularity framing");
  });

  test("plain engineering descriptions pass", () => {
    expect(
      checkNeutrality([
        "server-rendered React, one Node runtime, SQL store",
        "SPA frontend, Python API, you own the session layer",
      ]),
    ).toBeNull();
  });
});
