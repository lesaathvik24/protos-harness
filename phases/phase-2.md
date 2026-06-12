# Phase 2 (Week 2) — Glass-box trace + policy engine

**Goal (from plan.md):** Trace wired everywhere; `sessions`/`replay`/`why`/`/cost`; policy engine + 5 builtin rules; unit tests from ported hook fixtures.
**Demo:** agent writes an AWS key → policy deny → model rewords; `why` explains the turn.
**Riskiest item:** replay reusing the live renderer → budget one evening for a render-purity refactor (phase 1 task 11 was built pure to pre-empt this).

## Tasks

- [ ] **1. TraceEvent union + JSONL writer** — events: `api_request` (FULL messages array — deliberate redundancy, do not optimize), `api_response{usage,costUsd}`, `tool_call`/`tool_result{digest,sha256}`, `policy_verdict`, `perm_decision`, `teach_gate`, `fork_surfaced/rejected/resolved`, `trivial_logged`, `compaction`. Written to `~/.sobr/sessions/<id>/trace.jsonl`.
  - How: _pending_
- [ ] **2. Wire trace emission through loop/dispatch/provider** — every pipeline stage emits; loop tests assert event sequences.
  - How: _pending_
- [ ] **3. Cost tracking** — per-model pricing table, costUsd on every api_response, `/cost` in REPL.
  - How: _pending_
- [ ] **4. Policy engine** — `PolicyRule{check(toolCall) → Verdict{allow|warn|deny}}`; deny becomes `is_error` tool_result; warn renders but proceeds. Config: `custom` regex rules from `.sobr.json`.
  - How: _pending_
- [ ] **5. Builtin rules ×5** — port from this repo's hooks: secret-scan (deny, from `hooks/scan-secrets.sh`), dangerous-command (deny, `hooks/dangerous-command-guard.sh`), conventional-commit (deny, `hooks/commit-message-guard.sh`), dependency-audit (warn, no subprocess), git-status advisory (warn). Port every fixture in `tests/fixtures/**` as bun table tests.
  - How: _pending_
- [ ] **6. `sobr sessions` / `replay <id>` / `why <id>:<turn>`** — replay pumps trace events through the SAME live renderer; `why` prints the full api_request context for a turn.
  - How: _pending_
- [ ] **7. Session store** — session ids, metadata, list ordering.
  - How: _pending_

## Manual checks before Phase 3

1. **Live policy demo:** ask the agent to write a file containing a fake AWS key → watch deny → model rewords. (Needs API key.)
2. **Replay/why on a real session:** run `sobr replay <id>` and `sobr why <id>:<turn>` against a live session from check 1; output should match what the live run rendered.
3. `bun test` — all ported hook fixtures green (count should jump; target trajectory ≥80 total by week 3).
