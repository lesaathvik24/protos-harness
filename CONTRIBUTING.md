# Contributing to Protos Harness

Thanks for considering a contribution. This project is small and opinionated — keep changes focused and tested.

## Quick start

```bash
git clone https://github.com/lesaathvik24/protos-harness
cd protos-harness
bash tests/run.sh        # run the hook test suite
```

## Adding a new hook

1. Drop the script in `hooks/<name>.sh` — must be executable, must read JSON from stdin, must exit 0 (allow) or 2 (block).
2. Add a wiring entry to `settings.json` and `scripts/merge-settings.py`.
3. Add a test fixture in `tests/fixtures/<name>/` with `input.json` and `expected-exit` files.
4. Document it in `README.md`'s hook table.
5. Open a PR with **Conventional Commits** prefix (`feat:`, `fix:`, `docs:`, `chore:`, etc.).

## Adding a new skill

1. Create `skills/<slug>/SKILL.md` with frontmatter (name, description, trigger condition).
2. If the skill is curated from elsewhere, attribute the source in the SKILL.md.
3. Add it to the skills table in `README.md`.

## Adding a new agent

1. Two-agent budget — adding a third needs justification in the PR (token cost rationale).
2. Use `Read`-heavy tool sets; minimize `Bash` and mutating tools when possible.
3. Document invocation phrase + disable instructions in `README.md`.

## Code style

- Bash hooks: `set -euo pipefail`, parse JSON via `python3 -c`, avoid `grep -P` (BSD grep on macOS doesn't support it).
- Python scripts: stdlib only, no external deps.
- Markdown: line length ≤ 120 chars, no trailing whitespace.

## Testing

Each hook should have a fixture-based test. Add JSON input + expected exit code:

```
tests/fixtures/<hook-name>/
├── pass-input.json      # exit 0 expected
├── block-input.json     # exit 2 expected
└── expected.txt         # one of: pass, block
```

Run all tests: `bash tests/run.sh`

## Reporting issues

Use GitHub Issues with a minimal repro: the exact command, the exact JSON input that triggered it, and what you expected vs got.
