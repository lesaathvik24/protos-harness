import type { ToolCall } from "../tools/types.ts";

// Week-3 implements the real one-shot pendingTag write gate (fork/trivial → tag;
// write/edit consumes; untagged write/edit → is_error). Week-1 ships the seam:
// teach off ⇒ everything passes.

export type GateResult = { allowed: true } | { allowed: false; message: string };

export interface TeachGate {
  check(call: ToolCall): GateResult;
}

export class TeachOffGate implements TeachGate {
  check(_call: ToolCall): GateResult {
    return { allowed: true };
  }
}
