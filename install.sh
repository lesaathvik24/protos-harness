#!/usr/bin/env bash
# Protos Harness installer
# Usage: bash install.sh
#        curl -fsSL https://raw.githubusercontent.com/lesaathvik24/protos-harness/main/install.sh | bash
set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-$HOME/.claude}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing claude-harness to $CLAUDE_DIR..."

# Create directories
mkdir -p "$CLAUDE_DIR"/{hooks,agents,skills}

# Hooks
cp "$REPO_DIR"/hooks/*.sh "$CLAUDE_DIR/hooks/"
chmod +x "$CLAUDE_DIR/hooks/"*.sh
echo "  ✓ Hooks installed ($(ls "$REPO_DIR"/hooks/*.sh | wc -l | tr -d ' '))"

# Agents
cp "$REPO_DIR"/agents/*.md "$CLAUDE_DIR/agents/"
echo "  ✓ Agents installed (builder, tester)"

# Skills
cp -r "$REPO_DIR"/skills/. "$CLAUDE_DIR/skills/"
echo "  ✓ Skills installed ($(ls "$REPO_DIR/skills/" | wc -l | tr -d ' '))"

# Merge settings.json (non-destructive)
python3 "$REPO_DIR/scripts/merge-settings.py" "$CLAUDE_DIR/settings.json"
echo "  ✓ Settings merged"

echo ""
echo "Done. Restart claude to activate hooks."
echo ""
echo "To disable agents (saves ~4x tokens):"
echo "  rm $CLAUDE_DIR/agents/builder.md   # disable builder"
echo "  rm $CLAUDE_DIR/agents/tester.md    # disable tester"
