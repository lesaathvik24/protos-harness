# claude-harness

> v0.1 — beginner harness, actively building. Hooks work day-one; skills and agents are curated from the community. Original hooks and skills coming as the project matures.

A Claude Code harness for developers who want guardrails, not training wheels. Seven production-grade hooks that block secrets, dangerous commands, and bad commits — plus 23 curated skills and two purpose-built agents.

---

## Install

```bash
git clone https://github.com/lesaathvik/claude-harness
cd claude-harness
bash install.sh
```

Or one-liner (after repo is public):

```bash
curl -fsSL https://raw.githubusercontent.com/lesaathvik/claude-harness/main/install.sh | bash
```

Restart `claude` after install. That's it.

---

## Hooks

Seven hooks wired across the Claude Code event lifecycle.

| Hook | Trigger | Behavior | Type |
|------|---------|----------|------|
| `scan-secrets.sh` | PreToolUse: Write, Edit | Blocks writes containing `sk-`, `AKIA`, `ghp_`, `PRIVATE KEY`, `DATABASE_URL`, `password=`, `secret=` | **Blocking** |
| `dangerous-command-guard.sh` | PreToolUse: Bash | Blocks `rm -rf /`, `sudo rm`, `mkfs`, `dd if=`, `shutdown`, `reboot`, `diskutil eraseDisk`, `chmod -R 777 /` | **Blocking** |
| `commit-message-guard.sh` | PreToolUse: Bash | Enforces [Conventional Commits](https://www.conventionalcommits.org/) on `git commit -m` — requires `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, etc. | **Blocking** |
| `auto-lint.sh` | PostToolUse: Write, Edit | Runs `ruff + black` for `.py`, `prettier + eslint` for `.ts/.js/.jsx/.tsx`, `prettier` for `.json`. Skips silently if tools not installed | Warn |
| `test-impact.sh` | PostToolUse: Write, Edit | Runs `pytest` or `npm test` after non-test file edits. Detects project type from `pytest.ini`/`pyproject.toml`/`package.json` | Warn |
| `dependency-audit.sh` | PostToolUse: Bash | Runs `npm audit --audit-level=high` after `npm install/add`, `pip-audit` after `pip install` | Warn |
| `git-status-check.sh` | SessionStart | Warns on detached HEAD, merge conflicts, or >200 modified files before any work starts | Warn |

**Blocking** = hook returns exit code 2, Claude stops and reports the violation.  
**Warn** = hook prints to stderr, Claude continues.

### How hooks work

Claude Code hooks are shell scripts that receive tool input as JSON on stdin. The harness hooks parse this JSON, check for violations, and either exit 0 (allow) or exit 2 (block).

```bash
# Test any hook manually:
echo '{"command": "rm -rf /"}' | bash hooks/dangerous-command-guard.sh
# → BLOCKED: Dangerous command detected: rm -rf /
```

---

## Agents

Two subagents. Each costs ~4× more tokens than inline work — only invoke when the task is large enough to justify it.

### `builder` — implementation agent

Tools: `Read, Edit, Write, Bash, Glob, Grep`

Invoke: *"use the builder agent to refactor the auth module"*

Reads context, writes code, runs lint — does not run tests.

### `tester` — verification agent

Tools: `Read, Bash, Grep, Glob`

Invoke: *"use the tester agent to verify the new API endpoints"*

Runs tests, checks for regressions, audits output — does not write production code.

### Disabling agents

Agents cost ~4× tokens per invocation vs inline. If you're on a budget or don't need them:

```bash
rm ~/.claude/agents/builder.md   # disable builder
rm ~/.claude/agents/tester.md    # disable tester
```

Re-enable: `cp agents/builder.md ~/.claude/agents/`

---

## Skills (23 included)

Skills are slash-command workflows loaded on demand — they cost zero tokens when not active.

| Skill | Invoke | What it does |
|-------|--------|-------------|
| `tdd` | `/tdd` | Test-driven dev loop |
| `diagnose` | `/diagnose` | Disciplined bug diagnosis: reproduce → minimise → fix → regression test |
| `prototype` | `/prototype` | Throwaway prototype to validate a design before committing |
| `review` | `/review` | Review changes since a commit/branch along Standards + Spec axes |
| `qa` | `/qa` | Conversational QA session that files GitHub issues |
| `triage` | `/triage` | Issue triage state machine |
| `to-prd` | `/to-prd` | Turn a rough idea into a PRD |
| `to-issues` | `/to-issues` | Break a plan into independently-grabbable GitHub issues |
| `grill-me` | `/grill-me` | Stress-test your plan against your own domain model |
| `grill-with-docs` | `/grill-with-docs` | Same, but updates CONTEXT.md and ADRs inline |
| `design-an-interface` | `/design-an-interface` | Generate multiple radically different API designs in parallel |
| `improve-codebase-architecture` | `/improve-codebase-architecture` | Find refactoring opportunities, consolidate coupling |
| `handoff` | `/handoff` | Compact conversation into a handoff doc for another agent |
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

**Attribution:** skills are curated from [FleetView](https://fleetview.ai) and [mattpocock/skills](https://github.com/mattpocock). This harness bundles them for one-command install; original authorship belongs to those projects.

---

## Project structure

```
claude-harness/
├── .claude-plugin/          # Plugin manifest for /plugin install
│   ├── plugin.json
│   └── marketplace.json
├── hooks/                   # 7 bash hook scripts
├── skills/                  # 23 skill directories
├── agents/                  # builder.md + tester.md
├── scripts/
│   └── merge-settings.py    # Non-destructive settings.json merger
├── settings.json            # Reference hook config
└── install.sh               # One-command installer
```

---

## Roadmap

These are next on the list — contributions welcome:

- [ ] `cost-tracker.sh` — PostToolUse hook logging token delta per tool call to `~/.claude/session-costs.jsonl` + `/cost-report` skill to summarize spend
- [ ] `context-budget.sh` — PreToolUse hook warning when session is >70% of context window, suggests `/compact` or subagent
- [ ] `auto-checkpoint` skill — `/checkpoint` command that commits current state with timestamp, pairs with `/restore-checkpoint`
- [ ] Hook test suite — fixture JSON inputs + expected exit codes, runnable in CI
- [ ] Original skills — domain-specific skills written for this harness (not curated)

---

## Contributing

1. Fork → branch → PR
2. Conventional Commits required: `feat:`, `fix:`, `docs:`, `chore:`, etc.
3. For new hooks: include a "test manually" example in the PR description
4. For new skills: one `SKILL.md`, trigger condition in the frontmatter description

---

## License

MIT
