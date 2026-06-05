#!/usr/bin/env bash
# vibezombie — standalone installer (the anti-vibecoding flagship of protos-harness).
# Installs ONLY the skill + gate hook + one settings entry. None of the other harness parts.
# Usage: bash install-vibezombie.sh
#        curl -fsSL https://raw.githubusercontent.com/lesaathvik24/protos-harness/main/install-vibezombie.sh | bash
set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing vibezombie to $CLAUDE_DIR..."

mkdir -p "$CLAUDE_DIR/hooks" "$CLAUDE_DIR/skills/vibezombie"

cp "$REPO_DIR/hooks/vibezombie-gate.sh" "$CLAUDE_DIR/hooks/"
chmod +x "$CLAUDE_DIR/hooks/vibezombie-gate.sh"
echo "  ✓ Hook installed (vibezombie-gate.sh)"

cp "$REPO_DIR/skills/vibezombie/SKILL.md" "$CLAUDE_DIR/skills/vibezombie/"
echo "  ✓ Skill installed (/vibezombie)"

# Non-destructive, idempotent merge of just the one PreToolUse hook.
python3 - "$CLAUDE_DIR/settings.json" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
cmd = "~/.claude/hooks/vibezombie-gate.sh"

settings = json.loads(path.read_text()) if path.exists() else {}
pre = settings.setdefault("hooks", {}).setdefault("PreToolUse", [])

already = any(h.get("command") == cmd for m in pre for h in m.get("hooks", []))
if not already:
    hook = {"type": "command", "command": cmd}
    for m in pre:
        if m.get("matcher") == "Write|Edit":
            m.setdefault("hooks", []).append(hook)
            break
    else:
        pre.append({"matcher": "Write|Edit", "hooks": [hook]})

path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(settings, indent=2) + "\n")
print(f"  ✓ Settings wired into {path}")
PY

echo ""
echo "Done. Restart claude, then run /vibezombie to start choosing instead of accepting."
