# vibezombie — project doc

> Pick-up doc for future sessions. Status, architecture, decisions, and what's next — everything needed to
> resume without re-deriving context.

## What it is

The first **original** skill in `protos-harness`. A realtime anti-vibecoding coach: at each meaningful
decision the agent surfaces genuine alternatives *grounded in the actual codebase* (via `AskUserQuestion`)
and makes the user own the pick before any code is written. Three opt-in `PreToolUse` gates enforce it while
active: `Write|Edit` blocks untagged edits, `AskUserQuestion` blocks contaminated (career/popularity) fork
options, and `ExitPlanMode` blocks a plan that skipped the stack fork — so the agent can't silently skip the
lesson. Every decision is appended to an auditable log.

**Why it exists:** it's the deployed, demo-able public ship gating job applications. Hard constraints:
recruiter-legible and token-lean (terse forks, ≤2-sentence reveals).

## Status

- **Phase A — SHIPPED** (v0.2.0, commit `c37c1c8`, CI green on Ubuntu + macOS).
- **Fork-behavior fix — SHIPPED** (v0.3.0): forks are now **technical-only** with an explicit
  anti-motivation-policing rule, greenfield grounding, and conditional "it-depends" reveals that name the
  deciding dimension + threshold and re-fork once when it's unknown.
- **Phase B — SHIPPED** (v0.3.0): the cross-session learner model (`profile.md`) with suppression,
  ramping, and the `/vibezombie profile` control surface. Purely additive — nothing in A was a stub for it.
- **Structural enforcement — SHIPPED** (v0.4.0): scope→stack split into two ordered steps with bare factual
  options; two new opt-in hooks make the previously prompt-only rules *bind* on any model —
  `vibezombie-neutrality.sh` (blocks career/popularity framing in `AskUserQuestion` options) and
  `vibezombie-plan-gate.sh` (blocks `ExitPlanMode` until the stack fork is logged). Plus a visible `build:`
  marker echoed at activation to end stale-load ambiguity.

## Locked design decisions (do not re-litigate)

1. **Hybrid enforcement.** Skill = brain (judges *when* a fork is worth it, stakes-based, fuzzy judgment).
   Hook = spine (guarantees the agent can't ghost it).
2. **Stakes-based 3-level dial.** `L1` architecture-only · `L2` architecture+design (default) · `L3`
   everything teachable. Level set once at activation, changeable anytime, never per-fork.
3. **Two post-choice modes.** `Reveal` (default — after you pick, agent states the expert call in ≤2
   sentences) · `Hard` (justify-first Feynman gate, bound to L3).
4. **Per-edit tagging = unghostable + auditable.** Before any edit the agent logs `FORK` or
   `TRIVIAL:<≤5-word reason>`; the hook blocks untagged edits. The log is the demo artifact.
5. **Opt-in.** Hook is a no-op unless `active` exists, so it never contaminates normal work.
6. **Grounding is non-negotiable.** Options must be genuinely viable *for this repo* (read code first); no
   strawmen, no obvious-winner-plus-filler, **no pre-sold/pre-killed options** (marketing/recruiter
   adjectives banned). If only one sane path exists, it's not a fork → tag TRIVIAL.
7. **Global state, repo stays `protos-harness`.** Installable standalone OR with the whole harness.
8. **Forks are technical, never motivational.** Interrupt only for engineering decisions (stack, storage,
   data model, sync/async, library, pattern). Never ask *why* the user wants the product — expose the
   technical consequence of each branch instead. A technical *parameter* needed to choose (scale, latency,
   budget) is a legitimate conditioning fork; product motivation is not.
9. **"It depends" is first-class.** When >1 option is correct, the reveal is a **compact multi-axis
   tradeoff map** with **neutral options**, and the skill **asks what the user is optimizing** — a
   qualitative priority (ship speed · hiring · perf · learning) or a scalar threshold where the winner flips
   — then gives a recommendation **conditioned on that answer**, confirming the pick or flagging the
   mismatch. It never crowns a winner up front and **never** uses saved memory as a silent tiebreaker.
10. **Plan mode is not an exemption — hook-enforced.** Producing a plan / calling `ExitPlanMode` does not let
    high-stakes technical calls (stack · architecture · data model) skip the fork — they must be surfaced via
    `AskUserQuestion` *during planning*, before the plan commits, never pre-decided with "Key reason:" lines
    or deferred to "during build". `vibezombie-plan-gate.sh` (PreToolUse `ExitPlanMode`) blocks the plan until
    a `## FORK` is logged after the session marker, or an explicit, auditable `## NO-FORK: <reason>` escape.
11. **Neutrality is hook-enforced; scope ≠ stack.** Platform/scope ("where does it run", "what scope") is a
    plain question asked **first**; the stack/architecture it forces is a **separate** `AskUserQuestion` with
    bare factual options (comparison deferred to the post-pick reveal), never one fused option like
    "Web (React/Next.js)". `vibezombie-neutrality.sh` (PreToolUse `AskUserQuestion`) blocks option text
    carrying career/personal-advancement or popularity framing — the model-agnostic backstop for the
    always-on CLAUDE.md leak that wording alone couldn't stop, and it ships with the skill for any installer.

## Architecture

State under `~/.claude/.vibezombie/` (override via `VIBEZOMBIE_DIR` for tests):
- `active` — present ⇢ on; contents = level + optional `hard` (e.g. `L2`, `L3 hard`). Absent ⇢ off.
- `pending-tag` — one-shot token the skill mints (Bash) right before each edit; the hook **consumes** it.
- `log.md` — append-only decision log (FORK entries + TRIVIAL lines).
- `profile.md` — the learner model: `## mastered` (suppress) + `## shaky` (keep forking). Gate-irrelevant.

**Decision loop (while active):** in **plan mode**, the stack/architecture/data-model forks fire *before the
plan commits* (no pre-decided stack). classify stakes → map to a concept tag → if the concept is `mastered`
in `profile.md`, skip the fork (tag `TRIVIAL: mastered:<concept>`) → else if FORK: ground (read code, or for
greenfield ground in requirements) → `AskUserQuestion` with **neutral options** → tiered reveal (compact
multi-axis tradeoff map for big forks, ≤2 sentences for small ones) → ask the deciding factor (qualitative
priority or scalar threshold) once when it's unknown and flips the answer → recommendation **conditioned on
that answer**, confirming or flagging the pick (never assume the priority from memory) → update
`profile.md` → append to `log.md` + `touch pending-tag` (Bash) → do the edit. If TRIVIAL: log reason + mint
tag → edit. The hook on `PreToolUse(Write|Edit)`: `active` absent → exit 0; fresh `pending-tag` → consume +
exit 0; else **exit 2** with a "tag this edit first" message. `profile.md` does **not** affect the gate.

**Critical implementation note:** the skill manages state with **Bash only** (`echo`/`touch`/`cat >>`),
never the Write/Edit tools — because those tools are gated by the hook, so using them for state would
deadlock.

## Files (all shipped in Phase A)

| File | Role |
|------|------|
| `skills/vibezombie/SKILL.md` | The brain: control surface, stakes rubric, grounding + terseness rules, modes, tagging protocol |
| `hooks/vibezombie-gate.sh` | The gate: opt-in, consumes `pending-tag`, exit 0/2, honors `VIBEZOMBIE_DIR` |
| `hooks/vibezombie-neutrality.sh` | Opt-in `AskUserQuestion` gate: blocks career/popularity framing in fork options |
| `hooks/vibezombie-plan-gate.sh` | Opt-in `ExitPlanMode` gate: blocks a plan until a `## FORK`/`## NO-FORK` is logged |
| `install-vibezombie.sh` | Standalone installer (skill + gate + one settings entry), idempotent |
| `settings.json`, `scripts/merge-settings.py` | Gate registered under `PreToolUse` `Write|Edit` |
| `tests/run.sh` | Generic per-fixture `.setup` sourcing with fresh `VIBEZOMBIE_DIR` |
| `tests/fixtures/vibezombie/` | 3 gate fixtures: `pass-inactive` (0), `pass-tagged` (0), `block-untagged` (2) |
| `tests/scenarios/vibezombie/` | 6 behavioral rubrics (PASS/FAIL) for fork quality — run live, automate later |
| `README.md` | Flagship section (heading: "your AI is quietly making you a worse developer") |
| `CHANGELOG.md`, `.claude-plugin/*.json` | v0.2.0 release record + version bump |

## Control surface

- `/vibezombie` (no args) → one `AskUserQuestion` picking *Level* + *Mode*, then activate.
- `/vibezombie on L2` / `/vibezombie on L3 hard` → direct activate.
- `/vibezombie L1` → re-tune mid-session. `/vibezombie off` → clear `active`.
- `/vibezombie profile` → print the learner model. Subcommands: `... mastered <c>` / `... shaky <c>` /
  `... forget <c>` / `... reset`. The user owns the model.

## Verify / demo

- Unit (gate): `bash tests/run.sh` → 13 passed. `profile.md` is gate-irrelevant, so the count is unchanged.
- Standalone install into a clean dir: `CLAUDE_DIR=$(mktemp -d) bash install-vibezombie.sh`.
- Behavioral rubrics: walk `tests/scenarios/vibezombie/*.md` live and score against each PASS/FAIL block.
- **E2E (only testable in a live Claude Code session):** `/vibezombie on L2`, say "build a stock-trading
  app", confirm (a) the first fork is the **stack** with 3 real options — **not** "why do you want paper
  trading", (b) the reveal names a deciding dimension + threshold and re-forks once on scale, (c) an
  untagged edit is blocked, (d) `log.md` fills. Repeat a concept across turns → it lands in
  `profile.md ## mastered` and stops forking. `/vibezombie profile` prints/edits the model.
  `/vibezombie off` → edits flow normally. Repeat with `L3 hard` for the justify-first gate.

## Phase B — the cross-session learner model (SHIPPED in v0.3.0)

The gap in Phase A: it was **stateless about the user**. It grounded forks in the codebase but had no memory
of *you*, so it re-surfaced concepts you'd already mastered and couldn't ramp difficulty. Phase B adds:

- `~/.claude/.vibezombie/profile.md` — global record of concepts as `## mastered` (suppress) / `## shaky`
  (keep forking), keyed by short concept tags (`async-vs-sync`, `sql-vs-nosql`, …).
- **Auto-update:** after each fork the skill records the concept + confidence (a correct Hard-mode
  justification counts more than a Reveal-mode pick); a concept promotes to `mastered` after 3 confident
  demonstrations, or lands in `shaky` on fumbles.
- **Suppression:** mastered concepts aren't forked (logged `TRIVIAL: mastered:<c>`); interrupts go to new
  ground.
- **Ramping:** as `mastered` grows, reveals get terser and Hard-mode prompting increases.
- `/vibezombie profile` — inspect/correct the model: `mastered`/`shaky`/`forget <c>`/`reset` (user owns it;
  not a black box).

Sequenced second on purpose: a learner model on top of fake forks would memorize the wrong lessons. A is the
engine; B is personalization. The fork-behavior fix (technical-only, conditional reveals) shipped alongside
B so the model learns from real engineering forks, not motivation-policing.

## Reference

Full original plan: `~/.claude/plans/i-want-to-make-jaunty-stream.md`.
