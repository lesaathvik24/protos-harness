# sobr

**The coding agent that refuses to let you vibecode.** A teaching-first, glass-box agent runtime over
the Claude API (and any OpenAI-compatible API) — its own loop, typed tools, a policy engine, a
full-fidelity trace you can replay and interrogate, and a **teach mode** that makes you pick at every
real decision fork instead of rubber-stamping the model's output.

> Status: **week 4 of 4 — feature-complete, pre-launch.** Core runtime, glass-box trace, policy
> engine, multi-provider, teach mode, compaction, and resume are all built and tested (170 tests,
> `tsc` clean). Remaining before v0.1.0: live verification + the npm publish/name decision. See
> [`../plan.md`](../plan.md) for the spec and [`../phases/`](../phases/) for progress.

## Why it exists

Most coding agents optimize their *output*. sobr optimizes **what you learn and can audit**:

- **Teaching leads.** With `/teach on`, every genuine technical decision becomes a `fork` you must
  resolve yourself — neutral options, you pick, the model explains the tradeoffs *after*. An
  unskippable write gate means the agent literally cannot write code without classifying the decision
  first.
- **Glass-box.** Every API request (with its full message context), tool call, policy verdict, and
  permission decision is written to a JSONL trace. `sobr replay` re-renders any session; `sobr why`
  shows exactly what the model saw and every decision made in a turn.
- **Guardrails, not training wheels.** A policy engine blocks secrets, dangerous commands, and
  non-conventional commits before they run; mutating tools ask permission.

## Quickstart

Requires [Bun](https://bun.sh) ≥ 1.0.

```sh
cd sobr && bun install
export ANTHROPIC_API_KEY=sk-ant-...
bun run src/cli.ts                    # start the REPL in the current directory
```

```
sobr — sober coding, no vibes. claude-sonnet-4-6 · /your/repo
session 20260613-… · /help for commands

sobr> add a divide() to mathutils.ts and a test for divide-by-zero
⚒ read(mathutils.ts)
  → export function add(a, b) { return a + b }
⚒ edit(mathutils.ts)
  → Replaced 1 occurrence(s)
⚒ bash(bun test)
  → 4 pass, 0 fail
[claude-sonnet-4-6 · in 2.1k · out 340 · cache_read 1.8k · ctx ~0%] cost $0.01
```

### Commands

```sh
bun run src/cli.ts -p "fix the failing test"   # one-shot, then exit
bun run src/cli.ts sessions                    # list recorded sessions
bun run src/cli.ts replay <id>                 # re-render a session (same renderer as live)
bun run src/cli.ts why <id>:<turn>             # full model context + decisions for a turn
bun run src/cli.ts resume <id>                 # continue a prior session (rebuilds its history)
```

REPL slash commands: `/help` · `/cost` · `/compact` · `/teach on L1|L2|L3 [hard]` · `/teach off` ·
`/teach profile` · `/exit`.

## Teach mode (the headline)

`/teach on L2 hard` turns sobr into an anti-vibecoding coach. At every real technical decision the
model must call the `fork` tool — the runtime renders 2–4 **neutral** options (career/popularity
framing is rejected by validators ported verbatim from the original vibezombie hook), **blocks until
you pick**, and in hard mode asks you to type *why* before revealing the tradeoffs (tiered: a big
fork gets a multi-axis map and asks what you're optimizing; a small one gets ≤2 sentences).
Non-decisions go through `trivial` (≤5-word reason).

A one-shot **write gate** makes this unskippable: any `write`/`edit` without a prior `fork`/`trivial`
returns `GATED: classify first`. Your picks build a cross-session learner profile
(`~/.sobr/teach/profile.json` + a human-readable `log.md`) — 3 confident picks master a concept (a
hard-mode justification counts double) and the runtime then *deterministically refuses* to re-fork
it. Live verification rubrics are in [`test/scenarios/`](test/scenarios/).

## Glass-box trace, permissions, policy

Every session is traced to `~/.sobr/sessions/<id>/trace.jsonl` — the full request context per API
call, which is what makes `why` trivially correct and `resume` lossless. Mutating tools
(`write`/`edit`/`bash`) prompt before running: `y` once · `a` always this tool · `p` always this bash
prefix (chained commands past the prefix re-prompt) · `n` deny — grants last the session only.
Builtin policy: secret-scan, dangerous-command, conventional-commit (deny); dependency-audit (warn);
git-status advisory at startup.

## Configure

`~/.sobr/config.json` (global) then `<repo>/.sobr.json` (project) — JSON only, unknown keys fail loud:

```json
{ "model": "claude-sonnet-4-6", "maxTokens": 8192 }
```

### Other providers (GPT, DeepSeek, anything OpenAI-compatible)

```json
{ "provider": "openai", "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1", "apiKeyEnv": "DEEPSEEK_API_KEY" }
```

```json
{ "provider": "openai", "model": "gpt-4o" }
```

(`baseUrl` defaults to api.openai.com; `apiKeyEnv` defaults to `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`
by provider.) The stream is normalized so tools, permissions, policy, and trace are provider-blind.
Cost is computed only for known Claude models; others show `n/a` rather than a guess.

## Develop

```sh
bun run typecheck   # tsc --noEmit
bun test            # 170 tests; loop tests run on FakeAnthropic + recorded SSE fixtures,
                    # policy/neutrality table tests load the original hook fixtures from ../tests/fixtures
bun run build       # self-contained binary → dist/sobr (build:all for linux + macos targets)
bun run scripts/record-sse.ts   # record real stream events as fixtures (needs API key)
```

CI (`.github/workflows/sobr-ci.yml`) runs typecheck + test + a binary smoke-test on Ubuntu and macOS;
no live API calls in CI.

## Architecture

Pure functions everywhere, I/O only at the edges. See [`../plan.md`](../plan.md) for the full map.

```
src/
  cli.ts  repl.ts              entry; sessions/replay/why/resume; slash commands
  loop/agent.ts  dispatch.ts   turn loop; pipeline: policy → teach-gate → permission → execute
  provider/                    anthropic + openai-compatible, normalized to one StreamEvent union
  tools/                       read write edit bash glob grep + registry (ToolDef{mutates})
  permission/gate.ts           y/a/p/n, in-memory session grants
  policy/                      engine + rules ported from the repo's hooks
  teach/                       state · fork/trivial tools · write gate · neutrality · profile · prompt
  trace/                       events · writer (JSONL) · replay · why · cost · resume
  session/store.ts  config/    ~/.sobr/sessions + layered JSON config
  ui/                          pure renderer + status line
```

## Status & roadmap

v1 ships weeks 1–4 (above). Post-v1 (see `../plan.md`): Ink TUI, auto-compaction, persisted
allowlist, JS policy modules, post-tool actions, model-graded mastery, plan mode, MCP, subagents,
multi-provider eval automation. Good first issues are in [`docs/good-first-issues.md`](docs/good-first-issues.md).

> **npm name:** `sobr` is taken on npm by an unrelated package — v1 will publish as `sobr-cli` or a
> scoped name; the binary/command stays `sobr`. License: MIT.
