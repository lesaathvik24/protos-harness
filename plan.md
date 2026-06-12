# sobr — a teaching-first, glass-box AI coding-agent harness

## Context

protos-harness today is a Claude Code *config pack* (11 bash hooks, 24 skills, fixture tests). The user wants a real **agent runtime** in the pi/opencode class — own loop over the Claude API — as their job-switch portfolio ship. Decisions locked with user:

- **Direction:** greenfield TypeScript + Bun runtime; this repo becomes the spec, not the codebase.
- **Wedge (why anyone stars it):** all three pillars, **teaching leads** — "the coding agent that refuses to let you vibecode." Glass-box trace + policy engine support it.
- **Runway:** ~4 weeks part-time to a demo-able, npm-installable v1; then apply while iterating publicly.
- **Name:** `sobr` — the agent that codes sober instead of vibe coding. (npm: `sobr` is taken; publish as `sobr-cli` or a scoped package — decide at week-4 kickoff.) vibezombie stays as the teach-mode brand. Built in `sobr/` inside protos-harness for now; can be split to its own repo later.

Why owning the loop matters: vibezombie currently fights Claude Code from outside (bash hooks, regex on text, session tempfiles — 3 releases spent on leaks/scoping bugs). In-runtime, the fork is a tool call the loop controls; the entire hook layer collapses into typed validators.

## Spec sources (this repo — read during implementation)

- `skills/vibezombie/SKILL.md` — complete teach-mode contract (decision loop, L1/L2/L3, gate, profile, log formats)
- `hooks/vibezombie-neutrality.sh` — career/popularity regexes → `teach/neutrality.ts`
- `hooks/scan-secrets.sh`, `dangerous-command-guard.sh`, `commit-message-guard.sh` — policy rules
- `docs/HANDOFF-vibezombie-holistic.md` — locked fork-quality rules (neutral options, tiered reveal, ask-the-priority)
- `tests/fixtures/**` — port as bun table tests; `tests/scenarios/vibezombie/*.md` — week-3 manual rubrics

## Architecture

Single package, no workspace. Pillars are directories with clean seams; pure functions everywhere, I/O only at edges (`cli`, `repl`, `trace/writer`, `tools/*`).

```
src/
  cli.ts  repl.ts                  # entry; slash cmds: /teach /compact /cost
  loop/agent.ts  loop/dispatch.ts  # turn loop; pipeline: policy → teach-gate → permission → execute
  provider/anthropic.ts            # streaming, maxRetries:4, prompt-cache breakpoints
  tools/   read write edit bash glob grep + registry (ToolDef{mutates})
  permission/gate.ts               # allow/ask/deny + in-memory session grants
  policy/engine.ts + rules/        # PolicyRule → Verdict{allow|warn|deny}; deny = is_error tool_result
  teach/   state fork-tool neutrality profile prompt
  trace/   events writer replay why cost   # JSONL, ~/.sobr/sessions/<id>/
  session/store.ts  config/config.ts  ui/{render,prompt,status}
test/ unit/  loop/ (FakeAnthropic + recorded SSE fixtures)  fixtures/
```

Key types: `ToolDef<I>{mutates}`, `PolicyRule{check→Verdict}`, `Fork{decision,concept,stakes,options[2–4]{label,what}}`, `TeachState` (discriminated — no tag while off), `Profile{concepts:{status,confidentPicks,fumbles}}`, `TraceEvent` union.

### Loop essentials
- Stream via SDK; buffer tool_use blocks; on `tool_use` stop → dispatch pipeline → tool_results as one user message → continue. Tool failures (non-zero exit, missing file) are tool_results the model sees, never loop errors. Aborted streams discard the partial message.
- **Permissions:** read/glob/grep allow; write/edit/bash ask. y/once, a/always-this-tool, p/bash-prefix, n/deny. Session-memory only in v1.
- **Caching:** breakpoints on last system block + last tool def + last message block → conversation prefix cache-hits every tool iteration. Show `cache_read` savings in status line (a glass-box flex).
- **Compaction v1:** warn at 75%/90% context; manual `/compact` (one summarize call, logs `compaction` event). No auto-compact.
- Default model: `claude-sonnet-4-6` (config-overridable).

### Teaching mode (the headline)
Two tools injected only when teach is on:
- **`fork`** — runtime renders numbered neutral options, **blocks on user pick**; pick (+ Hard-mode justification prompt) becomes the tool_result. Model reveals tradeoffs after (tiered: big fork → ≤5-bullet map then ask the deciding priority; small → ≤2 sentences).
- **`trivial`** — `{reason ≤5 words}`, returns instantly.

**Write gate:** in-memory one-shot `pendingTag` (same semantics as the proven hook). fork-resolved or trivial → tag; write/edit consumes it; untagged write/edit → `is_error` "GATED: classify first — fork or trivial, then retry." Model self-corrects in-turn. Bash not gated (parity with current hook).

**Validators (pure, pre-render):** neutrality regexes (ported verbatim); 2–4 options; mastered concept → reject "call trivial"; stakes below active level → reject. Mastered-suppression becomes deterministic code, not a behavioral hope.

**Profile:** `~/.sobr/teach/profile.json` — 3 confident picks → mastered; plus human-readable `teach/log.md` in the existing SKILL.md FORK/TRIVIAL format (proven demo artifact).

v1: fork/trivial, gate, validators, Reveal+Hard, L1–L3, pick-count promotion, `/teach on L2 [hard]|off|profile`.
Deferred: model-graded mastery, ramping, plan-mode gate, chaining limits as code.

### Trace (glass-box)
JSONL per session; event union incl. `api_request` (**full messages array — deliberate redundancy; makes `why` trivially correct, do not optimize in v1**), `api_response{usage,costUsd}`, `tool_call/result{digest,sha256}`, `policy_verdict`, `perm_decision`, `teach_gate`, `fork_surfaced/rejected/resolved`, `trivial_logged`, `compaction`. Commands: `sobr sessions | replay <id> | why <id>:<turn>`; `/cost` in-REPL. Replay pumps events through the **same live renderer** (keeps it honest; forces render purity early).

### Policy v1
Builtins ported: secret-scan (deny), dangerous-command (deny), conventional-commit (deny), dependency-audit (warn, no subprocess), git-status session advisory (warn). vibezombie hooks → absorbed into teach. auto-lint/test-impact → post-v1 (post-tool actions, different mechanism). Config: JSON only — `~/.sobr/config.json` + project `.sobr.json`; `custom` regex rules cover the hook-style cases; fail loud on unknown keys.

## 4-week milestones (each ends demo-able)

| Wk | Ships | Demo | Riskiest item + mitigation |
|---|---|---|---|
| 1 | Scaffold, provider+caching, tools, dispatch, permissions, renderer/status | "add a function + test" works on a real repo | Streamed tool_use accumulation / multi-call turns → build FakeAnthropic + record real SSE fixtures **this week** |
| 2 | Trace wired everywhere; sessions/replay/why//cost; policy engine + 5 rules; unit tests from ported fixtures | Agent writes AWS key → deny → model rewords; `why` the turn | Replay reusing live renderer → budget one evening for render-purity refactor |
| 3 | fork/trivial, gate, validators, profile, /teach, Hard mode; teach prompt from SKILL.md + holistic handoff | `/teach on L2 hard` → stock-trading stack fork → pick → justification → map → gated edit; session 2 suppresses mastered | Model calling fork before writes → gate error doubles as recovery prompt (proven pattern); weekend reserved for prompt iteration vs rubrics |
| 4 | Compaction warn + /compact; resume from trace; npm publish + compiled binaries; README/CHANGELOG/CI/asciinema ×3 | `npx sobr` on a clean machine | Packaging friction → npm dry-run on **day 1** of week 4 |

Post-v1 (public roadmap): Ink TUI, auto-compaction, persisted allowlist, JS policy modules, post-tool actions, model-graded mastery, plan mode, MCP, subagents, multi-provider, eval automation, Windows.

## Testing

- bun test units: every existing hook fixture ported as table tests (policy, neutrality), profile promotion, trace roundtrip, edit-tool 0/multi-match failure. Target ≥80 tests honestly.
- Loop tests: FakeAnthropic over recorded SSE fixtures — text turn, single/parallel tool calls, policy-deny enters history, gate-block→trivial→retry.
- Scenario rubrics copied to `test/scenarios/` as manual week-3 checklists; LLM-judged eval harness post-v1 (say so in README).
- CI: `tsc --noEmit` + `bun test` + biome/oxlint on ubuntu+macOS. No live-API in CI.

## Launch (week 4)

README: hero GIF (fork firing) → pitch → 3-line `npx` quickstart → three pillars each with terminal excerpt → honest comparison vs aider/pi/opencode ("they optimize output; sobr optimizes what you learn and can audit") → ASCII dispatch-pipeline diagram → public roadmap. Day-1 credibility: green CI badge, real CHANGELOG 0.1.0, MIT, tagged release w/ binaries, 3–5 pre-filed good-first-issues, scenario rubrics visible in-repo. Asciinema ×3: plain fix-a-test, teach headline, `why` glass-box.

## Verification

- W1: live run against a scratch repo — multi-tool turn edits files; loop tests green.
- W2: `bun test` all ported fixtures; live policy-deny demo; `replay`/`why` on a real session.
- W3: run `stock-trading-stack.md`, `trivial-no-fork.md`, `mastered-suppression.md` rubrics live — all PASS criteria met.
- W4: `npx sobr` from a clean machine/user; CI green on both OSes; all three asciinema recordings reproduce.
