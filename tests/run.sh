#!/usr/bin/env bash
# Fixture-based test runner for hooks.
# Fixture naming convention: pass-*.json (expect exit 0) or block-*.json (expect exit 2).
set -uo pipefail
# Note: -e intentionally omitted; we manage exit codes per-test

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
FAILED_TESTS=()

# Map fixture directory to hook script
declare -a TEST_PAIRS=(
  "scan-secrets:scan-secrets.sh"
  "dangerous-command:dangerous-command-guard.sh"
  "commit-message:commit-message-guard.sh"
  "vibezombie:vibezombie-gate.sh"
  "vibezombie-neutrality:vibezombie-neutrality.sh"
  "vibezombie-plan-gate:vibezombie-plan-gate.sh"
  "vibezombie-session-cleanup:vibezombie-session-cleanup.sh"
)

for PAIR in "${TEST_PAIRS[@]}"; do
  FIXTURE_DIR="${PAIR%%:*}"
  HOOK_SCRIPT="${PAIR##*:}"
  HOOK_PATH="$REPO_DIR/hooks/$HOOK_SCRIPT"

  for FIXTURE in "$REPO_DIR/tests/fixtures/$FIXTURE_DIR"/*.json; do
    [[ -f "$FIXTURE" ]] || continue
    NAME=$(basename "$FIXTURE" .json)

    # Determine expected exit from filename prefix
    case "$NAME" in
      pass-*) EXPECTED=0 ;;
      block-*) EXPECTED=2 ;;
      *) echo "SKIP $FIXTURE (unknown prefix)"; continue ;;
    esac

    # Optional per-fixture state setup: a sibling <name>.setup is sourced with a
    # fresh VIBEZOMBIE_DIR, letting state-dependent hooks seed their filesystem.
    SETUP="${FIXTURE%.json}.setup"
    VIBEZOMBIE_DIR="$(mktemp -d)"
    export VIBEZOMBIE_DIR
    [[ -f "$SETUP" ]] && source "$SETUP"

    OUTPUT=$(bash "$HOOK_PATH" < "$FIXTURE" 2>&1)
    ACTUAL=$?

    rm -rf "$VIBEZOMBIE_DIR"
    unset VIBEZOMBIE_DIR

    if [[ $ACTUAL -eq $EXPECTED ]]; then
      PASS=$((PASS + 1))
      echo "  PASS  $FIXTURE_DIR/$NAME (exit=$ACTUAL)"
    else
      FAIL=$((FAIL + 1))
      FAILED_TESTS+=("$FIXTURE_DIR/$NAME (expected=$EXPECTED, got=$ACTUAL)")
      echo "  FAIL  $FIXTURE_DIR/$NAME (expected=$EXPECTED, got=$ACTUAL)"
      echo "        output: $OUTPUT"
    fi
  done
done

echo ""
echo "===================="
echo "Results: $PASS passed, $FAIL failed"
echo "===================="

if (( FAIL > 0 )); then
  echo ""
  echo "Failed tests:"
  for T in "${FAILED_TESTS[@]}"; do
    echo "  - $T"
  done
  exit 1
fi

exit 0
