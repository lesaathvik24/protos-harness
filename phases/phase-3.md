# Phase 3 (Week 3) — Teaching mode (the headline)

**Goal (from plan.md):** `fork`/`trivial` tools, write gate, validators, profile, `/teach`, Hard mode; teach prompt assembled from `skills/vibezombie/SKILL.md` + `docs/HANDOFF-vibezombie-holistic.md`.
**Demo:** `/teach on L2 hard` → stock-trading stack fork → pick → justification → tradeoff map → gated edit; session 2 suppresses mastered concepts.
**Riskiest item:** model calling fork before writes → the gate error doubles as the recovery prompt (proven pattern from the hook era); weekend reserved for prompt iteration against the rubrics.

## Tasks

- [ ] **1. TeachState** — discriminated union (no tag at all while off); injected into loop; `fork`+`trivial` tools only registered when teach is on.
  - How: _pending_
- [ ] **2. `fork` tool** — `Fork{decision,concept,stakes,options[2–4]{label,what}}`; runtime renders numbered neutral options and BLOCKS on user pick; pick (+ Hard-mode justification) becomes the tool_result; tiered reveal after (big fork → ≤5-bullet map then ask the deciding priority; small → ≤2 sentences).
  - How: _pending_
- [ ] **3. `trivial` tool** — `{reason ≤5 words}`, returns instantly, logs.
  - How: _pending_
- [ ] **4. Write gate** — in-memory one-shot `pendingTag`; fork-resolved or trivial → tag; write/edit consumes it; untagged write/edit → `is_error` "GATED: classify first — fork or trivial, then retry." Bash NOT gated (parity with the hook).
  - How: _pending_
- [ ] **5. Validators (pure, pre-render)** — neutrality regexes ported VERBATIM from `hooks/vibezombie-neutrality.sh`; 2–4 options; mastered concept → reject with "call trivial"; stakes below active level → reject. Table tests from existing fixtures.
  - How: _pending_
- [ ] **6. Profile** — `~/.sobr/teach/profile.json`: `{concepts:{status,confidentPicks,fumbles}}`; 3 confident picks → mastered; plus human-readable `teach/log.md` in the SKILL.md FORK/TRIVIAL format. Promotion unit tests.
  - How: _pending_
- [ ] **7. `/teach` command** — `/teach on L2 [hard] | off | profile`; L1–L3 levels.
  - How: _pending_
- [ ] **8. Teach system prompt** — assembled from SKILL.md contract + holistic handoff rules; injected only when teach on.
  - How: _pending_
- [ ] **9. Loop tests** — gate-block → trivial → retry self-correction; fork blocks and resumes with pick; mastered-suppression is deterministic (validator, not prompt hope).
  - How: _pending_

## Manual checks before Phase 4

1. **Run the three rubrics live** (from `tests/scenarios/vibezombie/`, copied to `sobr/test/scenarios/`): `stock-trading-stack.md`, `trivial-no-fork.md`, `mastered-suppression.md` — ALL PASS criteria met. (Needs API key + your judgment.)
2. **Prompt iteration:** if a rubric fails, iterate the teach prompt (weekend buffer) — record what changed and why in this file.
3. Session 2 of a real run actually suppresses a concept mastered in session 1 (profile persisted across sessions).
