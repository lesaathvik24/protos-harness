#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

CMD=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('command', ''))
" 2>/dev/null || true)

echo "$CMD" | grep -q 'git commit' || exit 0

# Extract -m message via python3 for portability
MSG=$(echo "$CMD" | python3 -c "
import sys, re
cmd = sys.stdin.read()
m = re.search(r'-m\s+[\"\'](.*?)[\"\']', cmd) or re.search(r'-m\s+(\S+)', cmd)
print(m.group(1) if m else '')
" 2>/dev/null || true)

[[ -z "$MSG" ]] && exit 0

VALID=$(echo "$MSG" | python3 -c "
import sys, re
msg = sys.stdin.read().strip()
pattern = r'^(feat|fix|refactor|docs|test|chore|style|perf|ci|build|revert)(\(.+\))?!?:'
print('yes' if re.match(pattern, msg) else 'no')
" 2>/dev/null || echo "yes")

if [[ "$VALID" == "no" ]]; then
  echo "BLOCKED: Commit message must use Conventional Commits prefix." >&2
  echo "  Expected: feat|fix|refactor|docs|test|chore|style|perf|ci|build|revert" >&2
  echo "  Got: $MSG" >&2
  exit 2
fi

exit 0
