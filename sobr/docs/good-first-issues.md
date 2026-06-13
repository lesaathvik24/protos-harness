# Good first issues

Pre-filed starter tasks for new contributors. Each is scoped to a single area with a clear
acceptance test. Drawn from the post-v1 roadmap in `../../plan.md`. (Draft — to be filed as GitHub
issues at launch.)

---

### 1. Persist the permission allowlist across sessions
**Area:** `src/permission/gate.ts`, `src/config/config.ts`
**Why:** Today `a` (always this tool) and `p` (always this bash prefix) grants are in-memory only, so
you re-grant every session. Persist them to `~/.sobr/config.json` (opt-in) and reload on startup.
**Acceptance:** grant `a` for `write` in one session; a new session in the same project does not
re-prompt for `write`. A flag/command can clear persisted grants. Add tests with an injected store.
**Size:** S–M.

---

### 2. `/teach profile` subcommands (`mastered` / `shaky` / `forget` / `reset`)
**Area:** `src/teach/controller.ts`, `src/teach/profile.ts`
**Why:** The original vibezombie skill let the user hand-edit the learner model. sobr's v1 only prints
it. Add `mastered <c>` / `shaky <c>` / `forget <c>` / `reset` (with a one-line confirm).
**Acceptance:** `/teach profile mastered sql-vs-nosql` makes future `sql-vs-nosql` forks suppressed;
`forget` removes it; `reset` empties the profile. Unit tests on `ProfileStore`.
**Size:** S.

---

### 3. Render teach + compaction events in `sobr why`
**Area:** `src/trace/why.ts`
**Why:** `replay` now renders fork/trivial events, but `why <id>:<turn>` doesn't surface them or
`compaction`. A turn that forked should show the decision and pick in its `why` output.
**Acceptance:** `why` on a turn containing a fork prints the decision, options, and the user's pick;
a turn with a compaction shows the before/after sizes. Add a test over a synthetic trace.
**Size:** S.

---

### 4. Custom regex policy rules from `.sobr.json`
**Area:** `src/policy/`, `src/config/config.ts`
**Why:** The plan calls for user-defined `custom` regex rules (deny/warn) in project config to cover
hook-style cases without code. Wire a `rules` config key into the `PolicyEngine`.
**Acceptance:** a `.sobr.json` rule like `{ "pattern": "TODO-SECURITY", "on": "edit", "verdict":
"deny" }` blocks a matching edit; unknown rule keys fail loud. Table tests.
**Size:** M.

---

### 5. `--model` / `--provider` CLI flags (override config per run)
**Area:** `src/cli.ts`, `src/config/config.ts`
**Why:** Quick model switches without editing `.sobr.json`. `sobr -p "…" --model claude-opus-4-8`.
**Acceptance:** flags override the resolved config; invalid values fail loud with the known list.
Tests on the arg parser.
**Size:** S.

---

### 6. Truncate oversized tool results before they enter history
**Area:** `src/loop/dispatch.ts` or the tools
**Why:** A `bash` or `read` returning a huge blob bloats context. Cap tool-result size fed back to the
model (keep the full body in the trace), with a "[truncated N bytes]" marker.
**Acceptance:** a tool result over the cap is truncated in `history` but the trace keeps the full
sha256/bytes; the model sees the marker. Add a loop test.
**Size:** S–M.

---

### 7. `sobr sessions --json` and basic filtering
**Area:** `src/cli.ts`, `src/session/store.ts`
**Why:** Make sessions scriptable. JSON output, and filter by cwd or date.
**Acceptance:** `sobr sessions --json` emits a parseable array; `--cwd <path>` filters. Tests on the
store/formatter.
**Size:** S.
