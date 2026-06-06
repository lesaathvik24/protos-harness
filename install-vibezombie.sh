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

for h in vibezombie-gate.sh vibezombie-neutrality.sh vibezombie-plan-gate.sh; do
  cp "$REPO_DIR/hooks/$h" "$CLAUDE_DIR/hooks/"
  chmod +x "$CLAUDE_DIR/hooks/$h"
  echo "  ✓ Hook installed ($h)"
done

cp "$REPO_DIR/skills/vibezombie/SKILL.md" "$CLAUDE_DIR/skills/vibezombie/"
echo "  ✓ Skill installed (/vibezombie)"

# Non-destructive, idempotent merge of the three vibezombie PreToolUse hooks.
python3 - "$CLAUDE_DIR/settings.json" <<'PY'
import json, sys
from pathlib import Path

path = Path(sys.argv[1])
# (matcher, command) — gate on edits, neutrality on questions, plan-gate on plans.
entries = [
    ("Write|Edit",      "~/.claude/hooks/vibezombie-gate.sh"),
    ("AskUserQuestion", "~/.claude/hooks/vibezombie-neutrality.sh"),
    ("ExitPlanMode",    "~/.claude/hooks/vibezombie-plan-gate.sh"),
]

settings = json.loads(path.read_text()) if path.exists() else {}
pre = settings.setdefault("hooks", {}).setdefault("PreToolUse", [])

for matcher, cmd in entries:
    if any(h.get("command") == cmd for m in pre for h in m.get("hooks", [])):
        continue
    hook = {"type": "command", "command": cmd}
    for m in pre:
        if m.get("matcher") == matcher:
            m.setdefault("hooks", []).append(hook)
            break
    else:
        pre.append({"matcher": matcher, "hooks": [hook]})

path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(settings, indent=2) + "\n")
print(f"  ✓ Settings wired into {path}")
PY

echo ""
echo "Done. Restart claude, then run /vibezombie to start choosing instead of accepting."
