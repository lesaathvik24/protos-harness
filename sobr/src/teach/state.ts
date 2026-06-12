// TeachState is discriminated — there is no tag (and no level) while off,
// so "gate bleed" across sessions is structurally impossible (the bug class
// that cost the hook era three releases).

export type TeachLevel = "L1" | "L2" | "L3";

export type TeachState =
  | { on: false }
  | { on: true; level: TeachLevel; hard: boolean; pendingTag: boolean };

const LEVEL_RANK: Record<TeachLevel, number> = { L1: 1, L2: 2, L3: 3 };

/** stakes clear the bar when at/above the active level (L1 stakes always do). */
export function stakesClearLevel(stakes: TeachLevel, active: TeachLevel): boolean {
  return LEVEL_RANK[stakes] <= LEVEL_RANK[active];
}

export class TeachSession {
  state: TeachState = { on: false };

  activate(level: TeachLevel, hard: boolean): void {
    this.state = { on: true, level, hard, pendingTag: false };
  }

  deactivate(): void {
    this.state = { on: false };
  }

  /** fork-resolved or trivial mints the one-shot tag. */
  mintTag(): void {
    if (this.state.on) this.state.pendingTag = true;
  }

  /** write/edit consumes it. One tag = one edit. */
  consumeTag(): boolean {
    if (this.state.on && this.state.pendingTag) {
      this.state.pendingTag = false;
      return true;
    }
    return false;
  }
}
