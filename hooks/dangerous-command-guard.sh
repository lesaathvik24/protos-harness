#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

CMD=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('command', ''))
" 2>/dev/null || true)

BLOCKLIST=(
  'rm -rf /'
  'rm -rf ~'
  'sudo rm'
  'mkfs'
  'dd if='
  'shutdown'
  'reboot'
  'diskutil eraseDisk'
  'chmod -R 777 /'
  'chmod -R 777 ~'
  '> /dev/sda'
  'format c:'
)

for PATTERN in "${BLOCKLIST[@]}"; do
  if echo "$CMD" | grep -qF "$PATTERN"; then
    echo "BLOCKED: Dangerous command detected: $PATTERN" >&2
    exit 2
  fi
done

exit 0
