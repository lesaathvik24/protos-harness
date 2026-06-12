# Phase 3 (Week 3) — Teaching mode (the headline)

**Goal (from plan.md):** `fork`/`trivial` tools, write gate, validators, profile, `/teach`, Hard mode; teach prompt assembled from `skills/vibezombie/SKILL.md` + `docs/HANDOFF-vibezombie-holistic.md`.
**Demo:** `/teach on L2 hard` → stack fork → pick → justification → tradeoff map → gated edit; session 2 suppresses mastered concepts.
**Riskiest item:** model calling fork before writes → the gate error doubles as the recovery prompt (proven pattern) — implemented exactly that way; the gate-block→trivial→retry self-correction is covered by a loop test.

**Status: code complete (2026-06-12). `tsc --noEmit` clean, `bun test` 151/151.**
**Remaining: the manual checks at the bottom — these are the heart of week 3 (prompt-vs-rubric iteration needs live judgment).**

## Tasks

- [x] **1. TeachState**
  - How: `src/teach/state.ts` — discriminated union: `{on:false} | {on:true; level; hard; pendingTag}` — **no tag field exists while off**, so the hook era's cross-session gate-bleed bug class is structurally impossible. `TeachSession` wraps it with `activate/deactivate/mintTag/consumeTag` (one-shot). `stakesClearLevel(stakes, active)` ranks L1≤L2≤L3. Tools injected only when on (see task 7 — registry swap).
- [x] **2. `fork` tool**
  - How: `src/teach/fork-tool.ts` `makeForkTool({session, profile, ui, trace})`. Input `{decision, concept, stakes:L1|L2|L3, options[2-4]{label, what}}`. Run order: validators (task 5) → `trace fork_surfaced` → **`ui.askPick` BLOCKS the loop on a real numbered pick** → hard mode: `ui.askText` justification → `profile.recordPick` (hard ×2) → FORK entry to log.md → `mintTag` → `trace fork_resolved`. The tool_result tells the model: the pick, the justification to check (hard), and the **tiered reveal rule** — stakes L1 = big fork → "≤5-bullet tradeoff map, ask the deciding priority via ONE more fork if unknown+flips-the-answer, conditioned recommendation ≤2 sentences"; else "≤2 sentences". `mutates:false` so it never hits the permission prompt. UI: `makeTerminalTeachUi` in `src/ui/prompt.ts` (numbered list + `pick [1-N]`).
- [x] **3. `trivial` tool**
  - How: same file, `makeTrivialTool` — `{reason}` validated to 1–5 words (`mastered:<concept>` shorthand counts as one), appends `- TRIVIAL: <reason>` to log.md, mints the tag, traces `trivial_logged`, returns instantly.
- [x] **4. Write gate**
  - How: `src/teach/gate.ts` `TeachWriteGate(session)` replaces the week-1 stub behind the SAME `TeachGate` interface (dispatch unchanged, as designed). teach off → pass; tool ∉ {write, edit} → pass (**bash not gated** — hook parity); else `consumeTag()` or block with `GATED: classify first — fork or trivial, then retry…` (the message IS the recovery prompt). `TeachOffGate` kept for embedding/tests. Gate is constructed once at session build and reads the shared `TeachSession`, so `/teach on` arms it with zero rewiring.
- [x] **5. Validators (pure, pre-render)**
  - How: in fork-tool run, before any render: 2–4 options (1 sane path → "call trivial"); valid stakes; **stakes below active level → reject**; **mastered concept → reject with `call trivial "mastered:<c>"`** (deterministic suppression — loop test proves the user is never interrupted); **neutrality** — `src/teach/neutrality.ts`, 8 career + 9 popularity regexes **ported verbatim** from `hooks/vibezombie-neutrality.sh`, first-match-wins, same labels; rejection text mirrors the hook's ("Rewrite for an anonymous engineer"). Every rejection is an is_error tool_result + `fork_rejected` trace. Tests: `test/unit/neutrality.test.ts` **loads the original `tests/fixtures/vibezombie-neutrality` fixtures**; `test/unit/fork-tool.test.ts` covers all validator paths.
- [x] **6. Profile**
  - How: `src/teach/profile.ts` `ProfileStore` → `~/.sobr/teach/profile.json` `{concepts:{<tag>:{status, confidentPicks, fumbles}}}`. `recordPick(concept, weight)` — hard mode passes weight 2 (SKILL.md: justification > reveal pick) — **promotes to mastered at ≥3**, deterministically. `recordFumble` → shaky (wired for week-4/post-v1 model-graded use; not auto-called in v1). Human-readable `log.md` in the SKILL.md FORK/TRIVIAL format (header seeded once). `render()` prints mastered/learning/shaky sections. Tests: `test/unit/profile.test.ts` (promotion, hard-weighting, cross-instance persistence, log format).
- [x] **7. `/teach` command**
  - How: `src/teach/controller.ts` `TeachController` — `/teach on L1|L2|L3 [hard]` (default L2), `/teach off`, `/teach profile`. Activation **swaps the agent registry** (base tools + fork + trivial — injected ONLY while on) and **appends the teach prompt to the system prompt**; deactivation restores both (Agent.deps made public for this; runTurn re-reads deps each iteration so mid-session swaps take effect on the next turn). Wired in `repl.ts` with the shared TeachSession + terminal UI + trace forwarding (fork_* / trivial_logged events stamped with the agent's current turn).
- [x] **8. Teach system prompt**
  - How: `src/teach/prompt.ts` `teachPrompt(level, hard)` — token-lean distillation of the SKILL.md contract: the 3-step decision loop, level definitions, fork-is-technical-only + **scope-is-never-a-fork** (no justification demands), platform-then-stack as two separate steps, bare/neutral options written for an anonymous engineer, never assume the priority from memory (ask it), tiered reveal (big = map + priority fork + conditioned rec; small ≤2 sentences), hard-mode check-then-reveal, honesty rules (under-calling defeats the mode; when unsure, fork; the block is the feature).
- [x] **9. Loop tests**
  - How: `test/loop/teach-loop.test.ts` on FakeAnthropic — **gate-block → trivial → retry** (GATED error enters history; model self-corrects in-turn; trivial+write sequential in ONE assistant message works because dispatch is sequential and the tag is consumed by the very next edit); **fork blocks and resumes with the pick** (askPick called exactly once, result carries pick + map rule, the following write passes the gate); hard-mode justification flows through; **mastered suppression with a pre-seeded profile** (askPick never called — suppression is code, not hope); teach off → no fork/trivial in registry, writes ungated. Plus controller tests (inject/restore, defaults, profile print). Scenario rubrics copied to `sobr/test/scenarios/` (9 files) for the manual checks.

## Notes for the next session

- The conditioning/priority fork ("ask what you're optimizing") is **prompt-driven** (the fork result instructs the model to issue ONE more fork with concrete buckets) — deliberately not a separate tool. If live runs show the model skipping it, consider a `priority` field requirement on big forks in week 4.
- `recordFumble` exists but nothing calls it automatically (model-graded mastery is post-v1 per plan). `/teach profile mastered|shaky|forget|reset` subcommands from SKILL.md were descoped from v1 (plan locks `/teach on|off|profile`).
- Teach trace events ride the same JSONL (`fork_surfaced/rejected/resolved`, `trivial_logged`) — replay/why ignore their payloads for now; rendering them is week-4 polish.
- Week-2 deferred item still open: custom regex policy rules from `.sobr.json`.

## Manual checks before Phase 4 (need a human + API key — the real week-3 work)

1. **Run the three rubrics live** (from `sobr/test/scenarios/`): `stock-trading-stack.md`, `trivial-no-fork.md`, `mastered-suppression.md` — `/teach on L2 hard`, follow each rubric's setup/prompt, ALL PASS criteria met. Also worth a pass: `holistic-stack-reveal.md` (the canonical fork-QUALITY case: neutral options → multi-axis map → asks what you optimize → conditioned recommendation; FAIL if it pre-sells a winner or imports your career goals).
2. **Prompt iteration (weekend buffer):** if a rubric fails, iterate `src/teach/prompt.ts` (and possibly the fork result text in `fork-tool.ts`) — record what changed and why HERE.
3. **Cross-session mastery:** session 1 — resolve the same concept 3× (or 2× hard); session 2 — same decision should be auto-classified `trivial mastered:<concept>` without surfacing a fork (the validator forces this even if the prompt forgets; confirm the model recovers gracefully from the rejection).
4. **Gate UX:** provoke an ungated edit early in a session (e.g. ask for a quick fix before any fork) and confirm the model recovers via trivial/fork without user help.
5. **Phases 1–2 manual checks still pending** (see phases/phase-2.md list — you said you'd verify after all phases; phase-4 packaging can proceed without them, but do them before tagging v0.1.0).
