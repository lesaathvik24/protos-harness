# Changelog

All notable changes to this project will be documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned
- `cost-tracker.sh` PostToolUse hook for per-tool token tracking
- `context-budget.sh` PreToolUse hook warning at >70% context usage
- `auto-checkpoint` skill with `/checkpoint` and `/restore-checkpoint` commands
- Original (non-curated) skills

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
