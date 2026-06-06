#!/usr/bin/env bash
# vibezombie session cleanup — runs on SessionEnd. Pure hygiene: scoping in the gate
# hooks already guarantees no cross-session bleed (a fresh session has its own id), so
# orphaned dirs are only clutter, never a correctness problem. This:
#   1. removes the ending session's scoped dir,
#   2. prunes session dirs older than 7 days (covers crashes where SessionEnd never fired),
#   3. deletes the legacy GLOBAL active/pending-tag flags (one-time migration off issue #1).
# State dir overridable via VIBEZOMBIE_DIR (tests).
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"
[[ -d "$VZ_DIR" ]] || exit 0

INPUT=$(cat 2>/dev/null || true)

SID=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    s = json.load(sys.stdin).get("session_id", "")
except Exception:
    s = ""
print("".join(c for c in str(s) if c.isalnum() or c in "._-"))
' 2>/dev/null || true)

# 1. Remove the ending session.
[[ -n "$SID" ]] && rm -rf "$VZ_DIR/sessions/$SID"

# 2. Prune orphaned session dirs (>7 days old).
[[ -d "$VZ_DIR/sessions" ]] && find "$VZ_DIR/sessions" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true

# 3. Legacy global flags must never gate a session again.
rm -f "$VZ_DIR/active" "$VZ_DIR/pending-tag" 2>/dev/null || true

exit 0
