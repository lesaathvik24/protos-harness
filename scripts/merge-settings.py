#!/usr/bin/env python3
"""Non-destructively merges harness hooks into an existing ~/.claude/settings.json."""
import json
import sys
import os
from pathlib import Path

HOOKS_CONFIG = {
    "hooks": {
        "PreToolUse": [
            {
                "matcher": "Write|Edit",
                "hooks": [{"type": "command", "command": "~/.claude/hooks/scan-secrets.sh"}]
            },
            {
                "matcher": "Bash",
                "hooks": [
                    {"type": "command", "command": "~/.claude/hooks/dangerous-command-guard.sh"},
                    {"type": "command", "command": "~/.claude/hooks/commit-message-guard.sh"}
                ]
            }
        ],
        "PostToolUse": [
            {
                "matcher": "Write|Edit",
                "hooks": [
                    {"type": "command", "command": "~/.claude/hooks/auto-lint.sh"},
                    {"type": "command", "command": "~/.claude/hooks/test-impact.sh"}
                ]
            },
            {
                "matcher": "Bash",
                "hooks": [{"type": "command", "command": "~/.claude/hooks/dependency-audit.sh"}]
            }
        ],
        "SessionStart": [
            {
                "matcher": "",
                "hooks": [{"type": "command", "command": "~/.claude/hooks/git-status-check.sh"}]
            }
        ]
    }
}

def main():
    settings_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / ".claude" / "settings.json"

    existing = {}
    if settings_path.exists():
        with open(settings_path) as f:
            existing = json.load(f)

    # Deep merge: preserve user's top-level keys, merge hooks by event type
    merged = {**existing}
    if "hooks" not in merged:
        merged["hooks"] = {}

    for event, matchers in HOOKS_CONFIG["hooks"].items():
        if event not in merged["hooks"]:
            merged["hooks"][event] = matchers
        else:
            # Append matchers that aren't already present (match by matcher + first hook command)
            existing_matchers = {
                (m.get("matcher", ""), m["hooks"][0]["command"])
                for m in merged["hooks"][event]
                if m.get("hooks")
            }
            for entry in matchers:
                key = (entry.get("matcher", ""), entry["hooks"][0]["command"])
                if key not in existing_matchers:
                    merged["hooks"][event].append(entry)

    with open(settings_path, "w") as f:
        json.dump(merged, f, indent=2)
        f.write("\n")

    print(f"Settings merged into {settings_path}")

if __name__ == "__main__":
    main()
