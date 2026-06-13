# Phase 4 (Week 4) — Compaction, packaging, launch

**Goal (from plan.md):** Compaction warn + `/compact`; resume from trace; npm publish + compiled binaries; README/CHANGELOG/CI/asciinema ×3.
**Demo:** `npx <package>` works on a clean machine.
**Riskiest item:** packaging friction → npm publish dry-run on DAY 1 of this week.
**Naming note (decided at kickoff):** `sobr` is TAKEN on npm (v1.1.1). `sobr-cli` was free as of 2026-06-12. Decide: `sobr-cli` vs scoped `@<user>/sobr`. Binary/command name can still be `sobr` either way.

**Status (2026-06-13): all autonomously-buildable tasks DONE. `tsc --noEmit` clean, `bun test` 170/170, compiled binary builds + runs, `npm pack --dry-run` clean. Three items inherently need the user — see the bottom.**

## Tasks

- [x] **1. npm publish dry-run (day 1)** — `npm pack --dry-run` → 47 files, 39.5 kB, includes src + README + CHANGELOG + LICENSE via a `files` allowlist.
  - How: package.json got `engines.bun`, `files`, `keywords`, `repository{directory:"sobr"}`, and a `//name` note. **Kept `private:true` + version `0.1.0-dev` on purpose** so nobody publishes before the name decision. **Known publish blocker (documented, needs the user):** `bin.sobr → src/cli.ts` has a `#!/usr/bin/env bun` shebang, so `npx <pkg>` only works where Bun is installed (node can't run `.ts`). The distribution that works without Bun on the target is the compiled binary (task 4). Real publish = pick the name, flip `private`, and either require Bun via `engines` (done) or add a JS build step for the bin.
- [x] **2. Context warnings + `/compact`**
  - How: `Agent.compact()` (`src/loop/agent.ts`) runs ONE summarize call with a dedicated `COMPACT_SYSTEM` prompt and **`tools:[]`** (so the model can't tool-call mid-summary), replaces `history` with `[user: "[Earlier conversation, compacted]\n<summary>", assistant: ack]`, tallies the call's usage/cost, and logs a `compaction` trace event `{beforeMessages, afterMessages, beforeTokens, summaryChars}`. `Agent.lastPromptTokens` tracks the last request's input+cache; `Agent.contextFraction()` divides by `contextWindowFor(model)` (new in `trace/cost.ts`: 1M for opus/sonnet/fable, 200k haiku, 200k fallback). REPL: `/compact` command + `maybeWarnContext()` prints a nudge at 75% (yellow) / 90% (red) after each turn. `status.ts` now takes an optional `contextTokens` so `ctx%` reflects the CURRENT prompt, not cumulative usage (which overstated it). Tests: `test/loop/compact.test.ts` (4) — replace+log, no-tools-on-summarize, empty no-op, contextFraction math.
- [x] **3. Resume from trace**
  - How: `src/trace/resume.ts` `historyFromTrace()` — the last `api_request.request.messages` carries the full history with **complete tool_result bodies** (the same redundancy `why` relies on), so resume is a lossless projection: clone that, append the final `api_response` content IFF it's a terminal answer (a trailing `tool_use` is dropped — clean resume point). `Agent.loadHistory()` seeds it. CLI `sobr resume <id>` → `runResume()` rebuilds, seeds a NEW session, drops into the shared `replLoop()` (refactored out of `runRepl`). Tests: `test/unit/resume.test.ts` (4) incl. the multi-iteration-tool case proving full tool_result bodies survive. Smoke-tested offline: rebuilds history, then fails loudly only at the missing key.
- [x] **4. Compiled binaries**
  - How: package.json scripts `build` (→ `dist/sobr`) + `build:linux-x64` / `build:darwin-arm64` / `build:darwin-x64` / `build:all` via `bun build --compile --target=…`. **Verified:** `bun run build` produced a 99 MB self-contained executable that runs `--help` with no Bun on PATH. `dist/` gitignored.
- [x] **5. CI**
  - How: `.github/workflows/sobr-ci.yml` — `test` job (typecheck + `bun test`) and `build` job (compile + `--help` smoke) on ubuntu + macOS, path-filtered to `sobr/**`, `bun install --frozen-lockfile`. **No live API in CI** (all tests use FakeAnthropic/fixtures). Parent `test-hooks.yml` left untouched.
- [x] **6. README (launch quality)**
  - How: rewrote `sobr/README.md` — pitch ("they optimize output; sobr optimizes what you learn and can audit"), a terminal-excerpt quickstart, teach-mode section, glass-box/permissions/policy section, multi-provider config, dev+CI+build, an ASCII architecture map, status/roadmap, and the npm-name + MIT note. (Hero GIF / asciinema embeds are placeholders pending the recordings — task 8.)
- [x] **7. CHANGELOG 0.1.0 + MIT LICENSE**
  - How: `sobr/CHANGELOG.md` (Unreleased = week-4 adds + packaging note; folded weeks 1–3 + the post-audit hardening). `sobr/LICENSE` = copy of the root MIT license. **Tagged release deferred** (outward-facing — see bottom).
- [x] **9. 3–5 good-first-issues pre-filed**
  - How: `sobr/docs/good-first-issues.md` — 7 scoped tasks from the post-v1 roadmap (persisted allowlist, `/teach profile` subcommands, teach events in `why`, custom regex policy rules, `--model`/`--provider` flags, tool-result truncation, `sessions --json`), each with area + acceptance + size. Drafted in-repo; **filing them as GitHub issues needs the user** (outward-facing).

## Needs the user (cannot complete autonomously)

- [ ] **8. Asciinema ×3** (plain fix-a-test · teach headline · `why` glass-box) — a genuine recording
  needs a live API key in an interactive terminal. The flows all work; record on your machine. README
  has the slots.
- [ ] **10. Publish** — `npm publish` needs your npm credentials AND the package-name decision
  (`sobr` taken → `sobr-cli` or `@<user>/sobr`); flip `private:false` and resolve the `.ts`-bin
  question (require Bun, or add a JS build step for `bin`). Everything is staged for it.
- [ ] **7b. Tagged GitHub release + attach binaries** — outward-facing; `bun run build:all` produces
  the artifacts, you cut the tag/release.
- [ ] **Filing the good-first-issues** as real GitHub issues (drafted in `sobr/docs/good-first-issues.md`).

## Manual checks before calling v1 done (carried from earlier phases + new)

1. `npx <package>` (or the compiled binary) on a clean machine reaches the REPL and completes a
   tool-use turn. (Needs API key.)
2. CI green on BOTH ubuntu and macOS (push will trigger `sobr-ci.yml`).
3. All three asciinema recordings reproduce from scratch.
4. **`/compact` live:** run a long session, `/compact`, confirm the summary is sensible and the next
   turn continues coherently; the 75/90% warnings fire as context fills.
5. **`resume` live:** `sobr resume <id>` on a real prior session continues with the right context.
6. Phases 1–3 manual checks (see phase-2.md / phase-3.md) — the rubric runs + live smoke test.
7. Decide & execute: split `sobr/` into its own repo, or keep in protos-harness with a README link
   (root README now points to sobr).
