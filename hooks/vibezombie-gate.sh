#!/usr/bin/env bash
# vibezombie gate — blocks untagged Write/Edit while learning mode is active.
# Scope is per-SESSION: the gate only fires in the exact session that ran /vibezombie.
# A session that never invoked the skill has no active flag, so it passes silently — no
# cross-session / cross-project bleed (issue #1). If the session id can't be read, we
# cannot scope the decision, so we ALLOW (never block on missing scope).
# State dir overridable via VIBEZOMBIE_DIR (used by the test suite).
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"

# Capture the tool-input JSON; we need session_id from it to scope the gate.
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

# No scope → never block.
[[ -n "$SID" ]] || exit 0

SESS_DIR="$VZ_DIR/sessions/$SID"

# Mode off for THIS session → allow silently.
[[ -f "$SESS_DIR/active" ]] || exit 0

# Mode on → every edit must carry a fresh tag the skill minted (FORK or TRIVIAL).
if [[ -f "$SESS_DIR/pending-tag" ]]; then
  rm -f "$SESS_DIR/pending-tag"   # one-shot: consume so the next edit needs its own tag
  exit 0
fi

echo "BLOCKED: vibezombie — tag this edit first. Surface a FORK (AskUserQuestion) or log TRIVIAL:<reason> to $VZ_DIR/log.md, then mint $SESS_DIR/pending-tag." >&2
exit 2
