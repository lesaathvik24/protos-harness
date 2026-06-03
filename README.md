# Protos Harness

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![test-hooks](https://github.com/lesaathvik24/protos-harness/actions/workflows/test-hooks.yml/badge.svg)](https://github.com/lesaathvik24/protos-harness/actions/workflows/test-hooks.yml)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](CHANGELOG.md)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-compatible-8B5CF6)](https://docs.anthropic.com/en/docs/claude-code)

> **v0.1 — beginner harness, actively building.** Hooks are battle-tested and ship-ready; skills and agents are curated from the community. Original hooks and skills land in future versions.

A Claude Code harness for developers who want guardrails, not training wheels. Seven production-grade hooks that block secrets, dangerous commands, and bad commits — plus 23 curated skills and two purpose-built agents.

---

## Install

```bash
git clone https://github.com/lesaathvik24/protos-harness
cd protos-harness
bash install.sh
```

Or one-liner:

```bash
curl -fsSL https://raw.githubusercontent.com/lesaathvik24/protos-harness/main/install.sh | bash
```

Restart `claude` after install. The installer is non-destructive — it merges into your existing `~/.claude/settings.json`, preserving your theme, effortLevel, and any other settings.

### Verify installation

```bash
# 1. Hooks are present and executable
ls -la ~/.claude/hooks/
# → 7 .sh files, all rwxr-xr-x

# 2. Hooks actually block — trigger each manually:
echo '{"content": "key = \"sk-abc123abc123abc123abc123abc\""}' | bash ~/.claude/hooks/scan-secrets.sh
# → BLOCKED: Secret pattern detected — OpenAI/Anthropic key (sk-)

echo '{"command": "rm -rf /data"}' | bash ~/.claude/hooks/dangerous-command-guard.sh
# → BLOCKED: Dangerous command detected: rm -rf /

echo '{"command": "git commit -m \"wip\""}' | bash ~/.claude/hooks/commit-message-guard.sh
# → BLOCKED: Commit message must use Conventional Commits prefix.

# 3. Agents are present
ls ~/.claude/agents/
# → builder.md  tester.md

# 4. Skills are present
ls ~/.claude/skills/ | wc -l
# → 23

# 5. Settings are wired
cat ~/.claude/settings.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.get('hooks',{}).keys()))"
# → ['PreToolUse', 'PostToolUse', 'SessionStart']
```

---

## Demo

```bash
$ echo '{"command": "rm -rf /var/www"}' | bash hooks/dangerous-command-guard.sh
BLOCKED: Dangerous command detected: rm -rf /

$ echo '{"content": "API_KEY = \"sk-abc123...\""}' | bash hooks/scan-secrets.sh
BLOCKED: Secret pattern detected — OpenAI/Anthropic key (sk-)

$ echo '{"command": "git commit -m \"stuff\""}' | bash hooks/commit-message-guard.sh
BLOCKED: Commit message must use Conventional Commits prefix.
  Expected: feat|fix|refactor|docs|test|chore|style|perf|ci|build|revert
  Got: stuff
```

---

## Hooks

Seven hooks wired across the Claude Code event lifecycle.

| Hook | Trigger | Behavior | Type |
|------|---------|----------|------|
| `scan-secrets.sh` | PreToolUse: Write, Edit | Blocks writes containing `sk-`, `AKIA`, `ghp_`, `ghs_`, `PRIVATE KEY`, `DATABASE_URL`, hardcoded `password=`/`secret=` | **Blocking** |
| `dangerous-command-guard.sh` | PreToolUse: Bash | Blocks `rm -rf /`, `sudo rm`, `mkfs`, `dd if=`, `shutdown`, `reboot`, `diskutil eraseDisk`, `chmod -R 777 /` | **Blocking** |
| `commit-message-guard.sh` | PreToolUse: Bash | Enforces [Conventional Commits](https://www.conventionalcommits.org/) on `git commit -m` | **Blocking** |
| `auto-lint.sh` | PostToolUse: Write, Edit | Runs `ruff + black` for Python, `prettier + eslint` for JS/TS, `prettier` for JSON. Silent if tools missing | Warn |
| `test-impact.sh` | PostToolUse: Write, Edit | Runs `pytest` or `npm test` after non-test file edits | Warn |
| `dependency-audit.sh` | PostToolUse: Bash | Runs `npm audit --audit-level=high` or `pip-audit` after install commands | Warn |
| `git-status-check.sh` | SessionStart | Warns on detached HEAD, merge conflicts, >200 modified files | Warn |

**Blocking** = exit 2, Claude stops and reports the violation.
**Warn** = exit 0, prints to stderr, Claude continues.

### How hooks work

Hooks are shell scripts that receive tool input as JSON on stdin. They parse the input, check for violations, and exit 0 (allow) or 2 (block).

```bash
# Test any hook manually:
echo '{"command": "rm -rf /"}' | bash hooks/dangerous-command-guard.sh
```

### Running the test suite

```bash
bash tests/run.sh
```

10 fixture-based tests cover the three blocking hooks (pass and block cases). CI runs them on every push across Ubuntu and macOS.

---

## Agents

Two subagents. Each costs **~4× more tokens** than inline work — only invoke when the task is large enough to justify it (e.g., reading 10 files to summarize, or running a full test suite where you don't want the output in your main context).

### `builder` — implementation agent
- Tools: `Read, Edit, Write, Bash, Glob, Grep`
- Invoke: *"use the builder agent to refactor the auth module"*
- Reads context, writes code, runs lint — does **not** run tests

### `tester` — verification agent
- Tools: `Read, Bash, Grep, Glob`
- Invoke: *"use the tester agent to verify the new API endpoints"*
- Runs tests, checks regressions, audits output — does **not** write production code

### Disabling agents

If you're token-budget-conscious or prefer inline work:

```bash
rm ~/.claude/agents/builder.md   # disable builder
rm ~/.claude/agents/tester.md    # disable tester
```

Re-enable: `cp agents/<name>.md ~/.claude/agents/`

---

## Skills (23 included)

Skills are slash-command workflows loaded on demand — they cost zero tokens when not active.

| Skill | Invoke | What it does |
|-------|--------|-------------|
| `tdd` | `/tdd` | Test-driven dev loop |
| `diagnose` | `/diagnose` | Disciplined bug diagnosis: reproduce → minimise → fix → regression |
| `prototype` | `/prototype` | Throwaway prototype to validate a design |
| `review` | `/review` | Review changes since a commit/branch (Standards + Spec) |
| `qa` | `/qa` | Conversational QA session that files GitHub issues |
| `triage` | `/triage` | Issue triage state machine |
| `to-prd` | `/to-prd` | Turn a rough idea into a PRD |
| `to-issues` | `/to-issues` | Break a plan into independently-grabbable issues |
| `grill-me` | `/grill-me` | Stress-test your plan against your own domain model |
| `grill-with-docs` | `/grill-with-docs` | Same, but updates CONTEXT.md + ADRs inline |
| `design-an-interface` | `/design-an-interface` | Generate radically different API designs in parallel |
| `improve-codebase-architecture` | `/improve-codebase-architecture` | Find refactoring opportunities |
| `handoff` | `/handoff` | Compact conversation into a handoff doc |
| `write-a-skill` | `/write-a-skill` | Build a new skill with proper structure |
| `find-skills` | `/find-skills` | Discover installable skills |
| `edit-article` | `/edit-article` | Restructure and tighten prose |
| `obsidian-vault` | `/obsidian-vault` | Search and manage Obsidian notes |
| `git-guardrails-claude-code` | `/git-guardrails-claude-code` | Block destructive git ops via hooks |
| `greploop` | `/greploop` | Iterate a PR until Greptile gives it 5/5 |
| `zoom-out` | `/zoom-out` | Step back and assess the bigger picture |
| `ubiquitous-language` | `/ubiquitous-language` | Align code terminology with domain language |
| `teach` | `/teach` | Explain a concept or codebase area |
| `setup-matt-pocock-skills` | `/setup-matt-pocock-skills` | Install mattpocock skill pack |

**Attribution:** skills are curated from [mattpocock/skills](https://github.com/mattpocock). Protos Harness bundles them for one-command install; original authorship belongs to that project.

---

## Project structure

```
protos-harness/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .github/workflows/
│   └── test-hooks.yml          # CI runs hook tests on push/PR
├── hooks/                      # 7 bash hook scripts
├── skills/                     # 23 skill directories
├── agents/                     # builder.md + tester.md
├── scripts/
│   └── merge-settings.py       # Non-destructive settings.json merger
├── tests/
│   ├── run.sh                  # Test runner
│   └── fixtures/               # JSON input fixtures, pass-/block- naming
├── settings.json               # Reference hook config
├── install.sh                  # One-command installer
├── LICENSE                     # MIT
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

---

## Roadmap

These are next on the list — PRs welcome:

- [ ] `cost-tracker.sh` — PostToolUse hook logging token delta per tool to `~/.claude/session-costs.jsonl` + `/cost-report` skill
- [ ] `context-budget.sh` — PreToolUse hook warning when session is >70% of context window
- [ ] `auto-checkpoint` skill — `/checkpoint` commits current state with timestamp; `/restore-checkpoint` rolls back
- [ ] Original (non-curated) skills written for this harness
- [ ] Optional Slack/Discord notification on blocked actions

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). TL;DR: fork, branch, add fixture-based tests for new hooks, open a PR with Conventional Commits.

---

## License

[MIT](LICENSE)
