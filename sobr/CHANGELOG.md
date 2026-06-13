# Changelog

All notable changes to `sobr` are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versioning is [SemVer](https://semver.org/).

## [Unreleased]

Week 4 in progress: compaction, resume, packaging, launch. v1 targets `0.1.0` once the live
verification checks pass (see `../phases/`).

### Added
- **Compaction** — `/compact` runs one summarize call that replaces the transcript with a dense
  summary, reclaiming context; the REPL warns at 75% / 90% of the model's window. Logs a
  `compaction` trace event.
- **Resume** — `sobr resume <id>` rebuilds a prior session's message history from its trace (the
  `api_request` events carry full tool-result bodies, so this is lossless) and continues in a new
  session.
- **Compiled binaries** — `bun run build` / `build:all` produce self-contained executables for
  linux-x64, darwin-arm64, darwin-x64 (no runtime needed on the target).
- **CI** — `.github/workflows/sobr-ci.yml`: typecheck + test + binary smoke-test on Ubuntu and
  macOS. No live API calls in CI (everything runs on FakeAnthropic / fixtures).
- Per-model context windows feed accurate `ctx%` in the status line.

### Packaging note
- The npm name `sobr` is already taken (an unrelated package). Publish as `sobr-cli` or a scoped
  name (`@<user>/sobr`) — the binary/command stays `sobr` either way. `npm publish` is deferred to
  the launch step; the package is not yet published.

## [0.0.x] — pre-release (weeks 1–3)

### Week 3 — teaching mode (the headline)
- `fork` / `trivial` tools injected only while `/teach` is on; `fork` blocks the loop on a real user
  pick, hard mode collects a typed justification, tiered reveal (big fork → tradeoff map +
  ask-the-priority; small → ≤2 sentences).
- One-shot write gate (untagged write/edit → `GATED`); bash not gated. Neutrality validators ported
  verbatim from the vibezombie hook. Cross-session learner profile (`~/.sobr/teach/`), 3 confident
  picks → mastered (hard picks weigh double); mastered concepts are deterministically suppressed.
- `/teach on L1|L2|L3 [hard] | off | profile`.

### Week 2 — glass-box trace + policy
- JSONL trace per session (`~/.sobr/sessions/<id>/`); `api_request` carries the full messages array.
- `sobr sessions | replay | why`; `/cost`. Replay re-renders through the same live renderer.
- Policy engine + 5 rules ported from the repo's hooks (secret-scan / dangerous-command /
  conventional-commit deny; dependency-audit warn; git-status startup advisory). Deny wins over warn.

### Week 1 — core runtime
- Streaming agent loop over the Claude API with a shared `assemble()`; prompt-cache breakpoints.
- Tools: read / write / edit / bash / glob / grep. Permission gate (y/a/p/n, session grants).
- Multi-provider: Anthropic + any OpenAI-compatible API (GPT, DeepSeek) via config.

### Hardening (post-audit)
- Fixed: `edit` corrupting `$`-sequences; permission prefix-grant command-chaining bypass; SSE
  final-event drop; profile write races; orphan `api_request` on abort. See `bugs.md`.
