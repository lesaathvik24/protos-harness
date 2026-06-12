import type { ToolCall } from "../tools/types.ts";
import type { TeachSession } from "./state.ts";

export type GateResult = { allowed: true } | { allowed: false; message: string };

export interface TeachGate {
  check(call: ToolCall): GateResult;
}

/** Used when teach mode isn't wired at all (tests, embedding). */
export class TeachOffGate implements TeachGate {
  check(_call: ToolCall): GateResult {
    return { allowed: true };
  }
}

export const GATED_MESSAGE =
  "GATED: classify first — fork or trivial, then retry. " +
  "You tried to write/edit without running the decision loop. " +
  "If this is a real technical decision call fork; if there is a single sane path (or the concept is mastered) call trivial with a ≤5-word reason, then retry the edit.";

const GATED_TOOLS = new Set(["write", "edit"]);

/**
 * The real write gate (same semantics as the proven vibezombie-gate.sh hook,
 * now in-memory): teach on ⇒ every write/edit consumes a one-shot pendingTag
 * minted by a fork-resolution or a trivial call. Untagged ⇒ is_error with the
 * recovery prompt above — the block IS the feature. Bash is NOT gated (parity
 * with the hook).
 */
export class TeachWriteGate implements TeachGate {
  constructor(private session: TeachSession) {}

  check(call: ToolCall): GateResult {
    if (!this.session.state.on) return { allowed: true };
    if (!GATED_TOOLS.has(call.name)) return { allowed: true };
    if (this.session.consumeTag()) return { allowed: true };
    return { allowed: false, message: GATED_MESSAGE };
  }
}
