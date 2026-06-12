import { describe, expect, test } from "bun:test";
import { TeachSession, stakesClearLevel } from "../../src/teach/state.ts";
import { TeachWriteGate, GATED_MESSAGE } from "../../src/teach/gate.ts";
import type { ToolCall } from "../../src/tools/types.ts";

const call = (name: string): ToolCall => ({ id: "t1", name, input: {} });

describe("teach write gate (one-shot pendingTag — hook semantics in-memory)", () => {
  test("teach off: everything passes (no tag state exists at all)", () => {
    const session = new TeachSession();
    const gate = new TeachWriteGate(session);
    expect(gate.check(call("write")).allowed).toBe(true);
    expect(gate.check(call("edit")).allowed).toBe(true);
    expect(session.state).toEqual({ on: false }); // discriminated: no pendingTag while off
  });

  test("teach on + untagged write/edit: GATED with the recovery prompt", () => {
    const session = new TeachSession();
    session.activate("L2", false);
    const gate = new TeachWriteGate(session);
    const result = gate.check(call("write"));
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.message).toBe(GATED_MESSAGE);
    expect(gate.check(call("edit")).allowed).toBe(false);
  });

  test("one tag = one edit: second write blocks again", () => {
    const session = new TeachSession();
    session.activate("L2", false);
    const gate = new TeachWriteGate(session);
    session.mintTag();
    expect(gate.check(call("write")).allowed).toBe(true);
    expect(gate.check(call("write")).allowed).toBe(false);
  });

  test("bash and read-only tools are NOT gated (hook parity)", () => {
    const session = new TeachSession();
    session.activate("L3", true);
    const gate = new TeachWriteGate(session);
    expect(gate.check(call("bash")).allowed).toBe(true);
    expect(gate.check(call("read")).allowed).toBe(true);
    expect(gate.check(call("glob")).allowed).toBe(true);
  });

  test("deactivating clears the tag with the state (no bleed)", () => {
    const session = new TeachSession();
    session.activate("L2", false);
    session.mintTag();
    session.deactivate();
    expect(session.consumeTag()).toBe(false);
    session.activate("L2", false);
    expect(new TeachWriteGate(session).check(call("write")).allowed).toBe(false); // fresh state, no stale tag
  });

  test("stakesClearLevel ranks L1 ≤ L2 ≤ L3", () => {
    expect(stakesClearLevel("L1", "L1")).toBe(true);
    expect(stakesClearLevel("L2", "L1")).toBe(false);
    expect(stakesClearLevel("L1", "L3")).toBe(true);
    expect(stakesClearLevel("L3", "L2")).toBe(false);
    expect(stakesClearLevel("L2", "L2")).toBe(true);
  });
});
