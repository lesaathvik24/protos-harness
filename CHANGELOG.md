# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- `cost-tracker.sh` PostToolUse hook for per-tool token tracking
- `context-budget.sh` PreToolUse hook warning at >70% context usage
- `auto-checkpoint` skill with `/checkpoint` and `/restore-checkpoint` commands

## [0.3.0] — 2026-06-05

### Added
- **`vibezombie` Phase B — cross-session learner model.** `~/.claude/.vibezombie/profile.md` tracks concepts as `## mastered` / `## shaky`; forks on mastered concepts are suppressed (logged `TRIVIAL: mastered:<concept>`), difficulty ramps as mastery grows, and the model auto-updates after each fork (a correct Hard-mode justification counts more than a Reveal-mode pick).
- **`/vibezombie profile`** control surface — inspect/correct the learner model: `mastered <c>` / `shaky <c>` / `forget <c>` / `reset`. The user owns the model.
- **`tests/scenarios/vibezombie/`** — human-readable behavioral rubrics (PASS/FAIL anti-patterns) for fork quality, including `holistic-stack-reveal.md` (neutral options + multi-axis map + priority fork) and `plan-mode-stack-fork.md` (plan mode must fork the stack). Run live now; automatable as transcript evals later.

### Changed
- **`vibezombie` forks are now technical-only.** Explicit anti-motivation-policing rule: the skill never asks *why* the user wants the product (the bug that made it ask "why do you want paper trading?"). It interrupts only for engineering decisions and exposes the technical consequence of each branch.
- **Holistic "it-depends" reveals with neutral options.** Options are stated flat (strengths and costs, no option pre-sold or pre-killed, marketing/recruiter adjectives banned); big forks get a compact multi-axis tradeoff map; and instead of assuming the priority from saved memory, the skill asks what the user is optimizing — a qualitative priority or a scalar threshold where the winner flips — then gives a recommendation conditioned on that answer, confirming or flagging the pick.
- **Greenfield grounding.** With no codebase to read, options are grounded in the stated requirements + realistic tech landscape (still real tradeoffs, no strawmen).
- **Plan mode is no longer an exemption.** The stack/architecture/data-model forks must fire via `AskUserQuestion` *during planning*, before the plan commits — plans may no longer present a pre-decided stack with "Key reason:" justifications or defer forks to "during build". Holds at every level/mode/model.

## [0.2.0] — 2026-06-05

### Added
- **`vibezombie`** — the first original skill written for this harness. A realtime anti-vibecoding coach: at each meaningful decision the agent surfaces genuine alternatives grounded in your actual codebase and makes you own the pick before code is written.
- `vibezombie-gate.sh` PreToolUse (Write/Edit) hook — blocks any untagged edit while `/vibezombie` mode is active, so the agent can't silently skip the lesson. No-op when inactive.
- Stakes dial (`L1`/`L2`/`L3`) and two modes (Reveal default, Hard justify-first). Every decision is appended to `~/.claude/.vibezombie/log.md` — an auditable record that nothing passed unexamined.
- `install-vibezombie.sh` — standalone installer for just the skill + gate hook (idempotent, non-destructive).
- 3 fixture-based tests for the gate (inactive / tagged / untagged); `tests/run.sh` now supports per-fixture state setup via sibling `.setup` files.

## [0.1.0] — 2026-06-03

### Added
- 7 hooks: `scan-secrets`, `dangerous-command-guard`, `commit-message-guard`, `auto-lint`, `test-impact`, `dependency-audit`, `git-status-check`
- 2 agents: `builder` (implementation), `tester` (verification) — each with disable instructions and 4× cost note
- 23 curated skills sourced from FleetView and mattpocock/skills
- `install.sh` one-command installer
- `scripts/merge-settings.py` non-destructive settings.json merger
- Plugin manifests (`.claude-plugin/plugin.json`, `marketplace.json`)
- Fixture-based hook test suite (`tests/`)
- GitHub Actions CI running hook tests on push/PR

### Fixed
- `scan-secrets.sh` and `commit-message-guard.sh` now use python3 regex instead of `grep -P` (incompatible with macOS BSD grep)
