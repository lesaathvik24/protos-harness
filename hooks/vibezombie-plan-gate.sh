#!/usr/bin/env bash
# vibezombie plan gate — binds rule #10 ("plan mode is not an exemption").
# While learning mode is active, blocks ExitPlanMode unless a stack/architecture
# decision was surfaced + logged DURING planning. The Write|Edit gate can't catch this
# (it never sees ExitPlanMode), so the railroaded "I'll fork during build" deferral
# slips through — this hook closes that gap. No-op unless the active flag exists.
# State dir overridable via VIBEZOMBIE_DIR (tests).
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"

# Drain stdin (the plan JSON); the decision is log-based, not content-based.
cat >/dev/null 2>&1 || true

# Mode off → allow silently.
[[ -f "$VZ_DIR/active" ]] || exit 0

LOG="$VZ_DIR/log.md"

# Look only at entries logged AFTER the last session marker (seeded at activation).
# Pass if a FORK was logged, or an explicit, auditable NO-FORK escape was recorded.
if [[ -f "$LOG" ]]; then
  TAIL=$(awk '
    /<!-- vz-session/ { buf=""; seen=1; next }
    { if (seen) buf = buf $0 "\n" }
    END { printf "%s", buf }
  ' "$LOG")
  if printf '%s' "$TAIL" | grep -qE '^## (FORK|NO-FORK)'; then
    exit 0
  fi
fi

echo "BLOCKED: vibezombie — plan mode is not an exemption (rule #10). The stack / architecture / data model is the highest-stakes fork: surface it via AskUserQuestion (neutral options + priority ask) and log it (## FORK) in $LOG BEFORE finalizing the plan. If this plan genuinely has no architecture decision, log '## NO-FORK: <reason>' to $LOG, then retry." >&2
exit 2
