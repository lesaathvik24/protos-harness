#!/usr/bin/env bash
# Blocks secret patterns from being written via Write or Edit tools
set -euo pipefail

INPUT=$(cat)

CONTENT=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
if 'content' in data:
    print(data['content'])
elif 'new_string' in data:
    print(data['new_string'])
" 2>/dev/null || true)

[[ -z "$CONTENT" ]] && exit 0

# Use python3 for cross-platform regex (avoids BSD grep -P limitation on macOS)
BLOCKED=$(echo "$CONTENT" | python3 -c "
import sys, re

patterns = [
    (r'sk-[A-Za-z0-9]{20,}',               'OpenAI/Anthropic key (sk-)'),
    (r'AKIA[0-9A-Z]{16}',                   'AWS access key (AKIA)'),
    (r'ghp_[A-Za-z0-9]{36}',               'GitHub PAT (ghp_)'),
    (r'ghs_[A-Za-z0-9]{36}',               'GitHub app token (ghs_)'),
    (r'PRIVATE KEY',                         'Private key block'),
    (r'DATABASE_URL\s*=\s*\S+',             'Database URL'),
    (r'(?i)password\s*=\s*[\"\']\S{8,}',   'Hardcoded password'),
    (r'(?i)secret\s*=\s*[\"\']\S{8,}',     'Hardcoded secret'),
]

content = sys.stdin.read()
for pattern, label in patterns:
    if re.search(pattern, content):
        print(label)
        break
" 2>/dev/null || true)

if [[ -n "$BLOCKED" ]]; then
  echo "BLOCKED: Secret pattern detected — $BLOCKED" >&2
  exit 2
fi

exit 0
