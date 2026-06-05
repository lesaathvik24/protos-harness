#!/usr/bin/env bash
# vibezombie gate — blocks untagged Write/Edit while learning mode is active.
# No-op unless the active flag exists, so it never touches normal work.
# State dir is overridable via VIBEZOMBIE_DIR (used by the test suite).
set -uo pipefail

VZ_DIR="${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"

# Drain stdin (tool-input JSON); the gate decision is state-based, not content-based.
cat >/dev/null 2>&1 || true

# Mode off → allow silently.
[[ -f "$VZ_DIR/active" ]] || exit 0

# Mode on → every edit must carry a fresh tag the skill minted (FORK or TRIVIAL).
if [[ -f "$VZ_DIR/pending-tag" ]]; then
  rm -f "$VZ_DIR/pending-tag"   # one-shot: consume so the next edit needs its own tag
  exit 0
fi

echo "BLOCKED: vibezombie — tag this edit first. Surface a FORK (AskUserQuestion) or log TRIVIAL:<reason> to $VZ_DIR/log.md, then mint $VZ_DIR/pending-tag." >&2
exit 2
