#!/usr/bin/env bash
# vibezombie plan gate — binds rule #10 ("plan mode is not an exemption").
# While learning mode is active, blocks ExitPlanMode unless a stack/architecture
# decision was surfaced + logged DURING planning. The Write|Edit gate can't catch this
# (it never sees ExitPlanMode), so the railroaded "I'll fork during build" deferral
# slips through — this hook closes that gap. Scope is per-SESSION (see vibezombie-gate.sh):
# only fires in the session that ran /vibezombie. State dir overridable via VIBEZOMBIE_DIR.
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"

# Capture the plan JSON; we need session_id from it to scope the gate.
INPUT=$(cat 2>/dev/null || true)

# Resolve the session id from the hook payload (sanitized for filesystem safety).
SID=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    s = json.load(sys.stdin).get("session_id", "")
except Exception:
    s = ""
print("".join(c for c in str(s) if c.isalnum() or c in "._-"))
' 2>/dev/null || true)

# No scope, or mode off for THIS session → allow silently.
[[ -n "$SID" ]] || exit 0
[[ -f "$VZ_DIR/sessions/$SID/active" ]] || exit 0

# The decision log is global (cross-session demo artifact + learner companion).
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
