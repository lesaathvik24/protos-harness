#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

FILE=$(echo "$INPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(data.get('file_path', data.get('filePath', '')))
" 2>/dev/null || true)

[[ -z "$FILE" ]] && exit 0

# Skip test files themselves
[[ "$FILE" == *test* || "$FILE" == *spec* ]] && exit 0

ROOT=$(git -C "$(dirname "$FILE")" rev-parse --show-toplevel 2>/dev/null || true)
[[ -z "$ROOT" ]] && exit 0

cd "$ROOT"

if [[ -f "package.json" ]]; then
  command -v npm &>/dev/null && npm test --silent 2>/dev/null || true
elif [[ -f "pytest.ini" || -f "pyproject.toml" || -f "setup.py" ]]; then
  command -v pytest &>/dev/null && pytest --tb=short -q 2>/dev/null || true
fi

exit 0
