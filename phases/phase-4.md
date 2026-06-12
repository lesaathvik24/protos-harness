# Phase 4 (Week 4) — Compaction, packaging, launch

**Goal (from plan.md):** Compaction warn + `/compact`; resume from trace; npm publish + compiled binaries; README/CHANGELOG/CI/asciinema ×3.
**Demo:** `npx <package>` works on a clean machine.
**Riskiest item:** packaging friction → npm publish dry-run on DAY 1 of this week.
**Naming note (decided at kickoff):** `sobr` is TAKEN on npm (v1.1.1). `sobr-cli` was free as of 2026-06-12. Decide: `sobr-cli` vs scoped `@<user>/sobr`. Binary/command name can still be `sobr` either way.

## Tasks

- [ ] **1. npm publish dry-run (day 1)** — pick final package name, `npm publish --dry-run`, fix metadata/files/bin issues NOW, not on launch day.
  - How: _pending_
- [ ] **2. Context warnings + `/compact`** — warn at 75%/90% of context; manual `/compact` = one summarize call, logs `compaction` trace event. No auto-compact in v1.
  - How: _pending_
- [ ] **3. Resume from trace** — `sobr resume <id>` rebuilds messages from the trace JSONL.
  - How: _pending_
- [ ] **4. Compiled binaries** — `bun build --compile` for linux-x64, darwin-arm64, darwin-x64; attach to tagged release.
  - How: _pending_
- [ ] **5. CI** — `tsc --noEmit` + `bun test` + biome/oxlint on ubuntu + macOS. No live-API calls in CI.
  - How: _pending_
- [ ] **6. README (launch quality)** — hero GIF (fork firing) → pitch → 3-line npx quickstart → three pillars each with a terminal excerpt → honest comparison vs aider/pi/opencode ("they optimize output; sobr optimizes what you learn and can audit") → ASCII dispatch-pipeline diagram → public roadmap.
  - How: _pending_
- [ ] **7. CHANGELOG 0.1.0 + MIT LICENSE + tagged release** — real changelog, tag, binaries attached.
  - How: _pending_
- [ ] **8. Asciinema ×3** — plain fix-a-test; teach headline (`/teach on L2 hard` flow); `why` glass-box.
  - How: _pending_
- [ ] **9. 3–5 good-first-issues pre-filed** — from the post-v1 roadmap (Ink TUI, persisted allowlist, JS policy modules, auto-compaction, model-graded mastery…).
  - How: _pending_
- [ ] **10. Publish** — npm publish for real; verify `npx <package>` from a clean machine/user.
  - How: _pending_

## Manual checks before calling v1 done

1. `npx <package>` on a clean machine (different user/laptop) reaches the REPL and completes a tool-use turn. (Needs API key.)
2. CI green on BOTH ubuntu and macOS.
3. All three asciinema recordings reproduce from scratch.
4. Decide & execute: split `sobr/` into its own GitHub repo, or keep in protos-harness with a README link (plan.md originally wanted its own repo).
