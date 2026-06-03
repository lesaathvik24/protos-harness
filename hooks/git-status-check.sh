#!/usr/bin/env bash
set -euo pipefail

# Skip if not in a git repo
git rev-parse --git-dir &>/dev/null || exit 0

STATUS=$(git status --porcelain 2>/dev/null)
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
MODIFIED=$(echo "$STATUS" | grep -c '^\s*M' || true)
CONFLICTS=$(echo "$STATUS" | grep -c '^[UA][UA]' || true)

WARNINGS=()

if [[ "$BRANCH" == "DETACHED" ]]; then
  WARNINGS+=("WARNING: Repository is in detached HEAD state.")
fi

if (( CONFLICTS > 0 )); then
  WARNINGS+=("WARNING: $CONFLICTS file(s) have merge conflicts.")
fi

if (( MODIFIED > 200 )); then
  WARNINGS+=("WARNING: $MODIFIED modified files — unusually large working tree.")
fi

if (( ${#WARNINGS[@]} > 0 )); then
  for W in "${WARNINGS[@]}"; do
    echo "$W" >&2
  done
  # Non-blocking: warn only, don't exit 2
fi

exit 0
