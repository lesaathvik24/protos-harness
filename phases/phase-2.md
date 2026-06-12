# Phase 2 (Week 2) — Glass-box trace + policy engine

**Goal (from plan.md):** Trace wired everywhere; `sessions`/`replay`/`why`/`/cost`; policy engine + 5 builtin rules; unit tests from ported hook fixtures.
**Demo:** agent writes an AWS key → policy deny → model rewords; `why` explains the turn.
**Riskiest item:** replay reusing the live renderer → pre-empted: week-1 renderer was built pure, replay needed no refactor.

**Status: code complete (2026-06-12). `tsc --noEmit` clean, `bun test` 107/107. CLI smoke-tested offline (sessions/replay/why against a synthetic trace).**
**Remaining: the manual checks at the bottom (need a human + API key).**

## Tasks

- [x] **0. (Scope addendum, user request) Multi-provider support — GPT / DeepSeek / any OpenAI-compatible API**
  - How: `src/provider/openai.ts` — `OpenAICompatProvider` over `fetch` `/chat/completions` (no extra SDK): pure `toOpenAIRequest()` (tool_result→role:"tool", tool_use→tool_calls, tools→functions), pure `normalizeChunks()` mapping tool_calls argument deltas → the SAME StreamEvent union (so assemble/loop/trace are provider-blind), SSE parser, 429/5xx retry with backoff. Config grew `provider` ("anthropic"|"openai"), `baseUrl`, `apiKeyEnv` (+ `resolveApiKey`). `assemble()` now absorbs late usage (OpenAI sends it at stream end). Cached-token counters (OpenAI `cached_tokens`, DeepSeek `prompt_cache_hit_tokens`) map to `cache_read`. DeepSeek recipe in sobr/README.md. Tests: `test/unit/openai.test.ts` (7).
- [x] **1. TraceEvent union + JSONL writer**
  - How: `src/trace/events.ts` — full union incl. week-3/4 placeholders (`fork_*`, `trivial_logged`, `compaction`); `api_request` carries the **full messages array** (do-not-optimize note kept); helpers `digestOf`/`sha256Of` (Bun.CryptoHasher). `src/trace/writer.ts` — `TraceWriter` appends JSONL to `<sessions>/<id>/trace.jsonl`; emit() is fire-and-forget but promise-chained so order is preserved; `flush()` awaits; `readTrace()` parses back. Tests: `test/unit/trace.test.ts`.
- [x] **2. Trace emission wired through loop/dispatch**
  - How: `Agent` takes `trace?: TraceEmitter`, stamps ts+turn on everything; emits `user_input`, `api_request` (full messages via structuredClone), `api_response` (content+usage+costUsd), `tool_call`, `tool_result` (digest+sha256+bytes), `turn_end`. Pipeline stages report through new `DispatchDeps.onTrace` (`policy_verdict`/`teach_gate`/`perm_decision`) which the Agent constructor wraps (chains any user hook). Loop tests assert the exact event sequence: `test/loop/trace-wiring.test.ts` (8) — incl. **policy-deny traced + write never happens + model sees is_error**.
- [x] **3. Cost tracking + `/cost`**
  - How: `src/trace/cost.ts` — per-MTok table (sonnet/opus/haiku/fable; cache read 0.1×, write 1.25×); **unknown models → null, rendered "n/a", never guessed** (openai-provider models show `≥$X (some models unpriced)`). Agent accumulates `totalCostUsd` + `costKnown`. REPL `/cost` and post-turn status line show usage + cost.
- [x] **4. Policy engine**
  - How: engine upgraded — **deny wins over warn regardless of rule order**, first warn kept otherwise (`src/policy/engine.ts`). `Verdict`/`PolicyRule` shapes unchanged from week 1, so dispatch didn't change. Custom `.sobr.json` regex rules: NOT done — deferred to week 4 polish (plan lists it under config; no current consumer).
- [x] **5. Builtin rules ×5 (ported from this repo's hooks, fixtures included)**
  - How: `src/policy/rules/` — `secret-scan.ts` (8 regexes verbatim from `hooks/scan-secrets.sh`, scans write.content + edit.new_string, deny), `dangerous-command.ts` (12-entry fixed-substring blocklist verbatim, bash only, deny), `conventional-commit.ts` (git commit -m extraction: quoted-then-bare like the hook; no -m passes; deny), `dependency-audit.ts` (npm install/i/add + pip install → warn, **no subprocess** per plan), `git-status.ts` (session-START advisory fn, not a PolicyRule: detached HEAD / conflicts / >200 modified — printed by the REPL on startup). `defaultRules()` wired in `buildSession`. Tests: `test/unit/policy.test.ts` — **table tests load the ORIGINAL fixtures from repo-root `tests/fixtures/{scan-secrets,dangerous-command,commit-message}` directly** (single source of truth) + engine precedence tests; `test/unit/git-status.test.ts` (3, real git repos; note: sandbox forces commit signing → tests pass `-c commit.gpgsign=false`).
- [x] **6. `sobr sessions` / `replay <id>` / `why <id>:<turn>`**
  - How: `src/cli.ts` subcommands. `sessions` lists id/started/model/turns/cost. `replay` = `src/trace/replay.ts`: pure `traceToUiEvents()` then **the same `render()` the live REPL uses** (api_response text→text_delta, tool_call/tool_result→same UiEvents); user prompts + warn/deny lines are replay chrome. `why` = `src/trace/why.ts`: prints the full api_request messages JSON (trivially correct thanks to the redundancy), response usage/cost, policy/teach/permission decisions, tool_result digests; missing turn lists available turns. Prefix-resolution on session ids (`store.resolve`).
- [x] **7. Session store**
  - How: `src/session/store.ts` — `~/.sobr/sessions/<id>/{meta.json,trace.jsonl}`; `newSessionId()` = sortable `YYYYMMDD-HHmmss-rand4`; `list()` newest-first; `resolve()` exact-or-unique-prefix with ambiguity errors; REPL prints the session id at startup and `runRepl/runOneShot` flush the writer on exit.

## Notes for the next session

- Replay needed zero renderer changes — `render()` purity from week 1 paid off exactly as planned.
- `TraceEvent` already has the week-3 variants (`fork_surfaced/rejected/resolved`, `trivial_logged`); week 3 just emits them.
- Deferred from this phase: custom regex policy rules from `.sobr.json` (week-4 polish), `/cost` per-turn breakdown (have the data in trace, render later if wanted).
- Offline CLI smoke test recipe: build a synthetic session with TraceWriter under a scratch `$HOME`, then `sobr sessions / replay / why` (done 2026-06-12, all three correct).

## Manual checks before Phase 3 (need a human + API key)

1. **Live policy demo (the week-2 demo):** ask the agent to *"write my AWS key AKIAIOSFODNN7EXAMPLE to creds.txt"* → watch `⛔ secret-scan` deny → the model should reword/refuse on its own. Also try `git commit -m "stuff"` via the agent → conventional-commit deny → model retries with a proper prefix.
2. **Replay/why on a real session:** after check 1, `bun run src/cli.ts sessions`, then `replay <id>` — output should visually match what the live run showed; `why <id>:1` should show the full request context including the denied tool_result.
3. **Phase-1 checks still pending** (deferred by user to after phase 2): live "add a function + test" demo, permission UX feel, `scripts/record-sse.ts` wire-format recording, cache_read non-zero check.
4. **Multi-provider spot check (optional but recommended):** drop `{ "provider": "openai", "model": "deepseek-chat", "baseUrl": "https://api.deepseek.com/v1", "apiKeyEnv": "DEEPSEEK_API_KEY" }` into a scratch repo's `.sobr.json` → one tool-use turn end to end; cost shows "n/a"/unpriced as designed.
