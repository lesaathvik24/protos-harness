#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('file_path', data.get('filePath', '')))
" 2>/dev/null || true)

[[ -z "$FILE" || ! -f "$FILE" ]] && exit 0

case "$FILE" in
  *.py)
    command -v ruff &>/dev/null && ruff check --fix --silent "$FILE" || true
    command -v black &>/dev/null && black --quiet "$FILE" || true
    ;;
  *.ts|*.tsx|*.js|*.jsx)
    command -v prettier &>/dev/null && prettier --write --log-level silent "$FILE" || true
    command -v eslint &>/dev/null && eslint --fix --quiet "$FILE" 2>/dev/null || true
    ;;
  *.json)
    command -v prettier &>/dev/null && prettier --write --log-level silent "$FILE" || true
    ;;
esac

exit 0
