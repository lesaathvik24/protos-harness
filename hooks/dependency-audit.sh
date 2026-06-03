#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

CMD=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('command', ''))
" 2>/dev/null || true)

if echo "$CMD" | grep -qE 'npm (install|i|add)'; then
  echo "Running npm audit after install..." >&2
  npm audit --audit-level=high 2>&1 || {
    echo "WARNING: npm audit found high/critical vulnerabilities." >&2
  }
fi

if echo "$CMD" | grep -qE 'pip install'; then
  command -v pip-audit &>/dev/null && pip-audit 2>&1 || true
fi

exit 0
