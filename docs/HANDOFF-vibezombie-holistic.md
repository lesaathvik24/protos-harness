# HANDOFF — vibezombie "holistic forks" refinement (resume doc)

> Self-contained pick-up doc. Everything needed to continue without re-deriving context. Written mid-task:
> the plan is **approved**, implementation of this refinement is **NOT started** (task #5 was just marked
> in_progress, zero edits made for it yet). Read this top-to-bottom, then start at **§7 Implementation**.

---

## 1. What this project is

- **Repo:** `protos-harness`, working dir `~/Downloads/claude-harness`, branch `main`, git user `lesaathvik24`.
- **`vibezombie`** is the user's **flagship original skill** and the public, demo-able ship gating their job
  applications (SDET → AI/ML/SWE pivot; see global `~/.claude/CLAUDE.md` "Ship rule"). Hard constraints:
  **recruiter-legible** and **token-lean**.
- It's a realtime anti-vibecoding coach: while active, at each meaningful **technical** decision the agent
  surfaces genuine alternatives, makes the user **own the pick**, then writes code. A `PreToolUse(Write|Edit)`
  hook (`hooks/vibezombie-gate.sh`) blocks any untagged edit so the agent can't ghost it. Every decision is
  appended to `~/.claude/.vibezombie/log.md` (the demo artifact).
- **Full architecture/status doc:** `docs/vibezombie.md` (read it too — it's the canonical pick-up doc).
  **Approved plan for THIS refinement:** `~/.claude/plans/lets-fix-all-the-dreamy-simon.md`.
- **Memory:** `~/.claude/projects/-Users-lekhansaathvik-Downloads-claude-harness/memory/vibezombie-flagship.md`
  (project memory; keep it current).

---

## 2. Git state (nothing committed this whole session)

Last commit: `c37c1c8 feat: add vibezombie — realtime anti-vibecoding coach (v0.2.0)`.

Uncommitted working-tree changes (`git status --short`):
```
 M .claude-plugin/marketplace.json     # version 0.2.0 → 0.3.0
 M .claude-plugin/plugin.json          # version 0.2.0 → 0.3.0
 M CHANGELOG.md                        # added [0.3.0] entry
 M README.md                           # flagship section updates
 M skills/vibezombie/SKILL.md          # technical-fork + scope + Phase B rewrite (187 lines)
?? .claude/                            # (local settings/plans noise — ignore)
?? docs/                               # UNTRACKED: docs/vibezombie.md + this handoff
?? tests/scenarios/                    # UNTRACKED: new scenario suite
```
**Note `docs/` and `tests/scenarios/` are untracked dirs** — they need `git add` when committing.
Nothing has been committed yet; the user has not asked to commit.

---

## 3. What ALREADY shipped this session (done — do not redo)

All on `main`, uncommitted. Three sub-tasks completed before this refinement:

**(A) Technical-only forks + anti-motivation-policing** — `skills/vibezombie/SKILL.md`
- Forks are technical decisions only; the skill never interrogates product motivation ("why do you want
  paper trading"). Fixed the original bug.

**(B) Scope-is-not-a-fork** — `skills/vibezombie/SKILL.md` §"What a fork is — and is NOT"
- Scope/features/product direction ("MVP vs full platform", "which domains") are plain clarifying questions,
  NEVER forks, NEVER justify-first. Hard mode only fires on genuine technical forks. Fixed the second bug
  (it was forking on scope + demanding justification).

**(C) Phase B — cross-session learner model** — `skills/vibezombie/SKILL.md`
- `~/.claude/.vibezombie/profile.md`: `## mastered` (suppress forks, log `TRIVIAL: mastered:<c>`) / `## shaky`.
  Auto-updates after each fork (Hard-mode justification > Reveal pick). Ramping. `/vibezombie profile`
  control surface (`mastered`/`shaky`/`forget`/`reset`). Gate hook unchanged — profile is gate-irrelevant.

**(D) Scenario test suite** — `tests/scenarios/vibezombie/` (6 files) + `tests/scenarios/README.md`
- `stock-trading-stack.md` (canonical), `conditional-storage.md`, `mastered-suppression.md`,
  `trivial-no-fork.md`, `greenfield-grounding.md`, `scope-not-a-fork.md`. Human-readable PASS/FAIL rubrics
  for live runs; to be automated as transcript evals later.

**(E) Docs/release** — `docs/vibezombie.md` (Phase B marked shipped), `CHANGELOG.md` (`[0.3.0]`),
  both `.claude-plugin/*.json` bumped 0.2.0 → 0.3.0, `README.md` flagship section, memory file updated.

**Verified:** `bash tests/run.sh` → **13 passed** (gate untouched). `install-vibezombie.sh` into a temp dir
works. SKILL.md is currently **187 lines**.

---

## 4. The NEW problem this refinement fixes — fork QUALITY ("be holistic")

A live "build an app like Twitch" run (`/vibezombie on L2 hard`) exposed that the forks, while now correctly
*technical*, are **low quality / not holistic**. Three failures, all confirmed with the user:

1. **Rigged options.** The stack fork pre-sold a winner and trapped the rest:
   - *"1. Next.js — Most Twitch clones use this. **Strong recruiter signal**."* ← pre-sold
   - *"3. SvelteKit — Leaner... **fewer employers know it**."* ← pre-killed/trap
   This is the obvious-winner-plus-filler the skill's own rules already ban — but it did it anyway.
2. **Single-axis reveal.** Every reveal collapsed onto **one** dimension — *"your SWE portfolio / recruiter
   signal"* — and declared Next.js the real answer. User picked SvelteKit, justified "cuz its leaner", got
   told they were basically wrong ("Next.js de-risks your portfolio, pick Svelte only if you want to learn
   it"). That's railroading, not holistic coaching.
3. **Assumed priorities.** It silently imported the user's career goal (from saved memory / CLAUDE.md) as
   the master tiebreaker, never asking what they were optimizing for on *this* project.

**Root cause behind #2:** SKILL.md mandates *"≤2-sentence reveals / do not lecture"* — that hard cap leaves
no room for a multi-dimensional answer, so the model collapses to one axis.

User's words: "i need u to be holistic, this is very subpar product." And a hard constraint added at plan
approval: **"it shouldnt take up much context"** — SKILL.md loads every session, so edits must be token-lean.

---

## 5. Confirmed design decisions (from AskUserQuestion — locked, don't re-litigate)

1. **Which failures to fix:** ALL THREE (rigged options + single-axis reveal + assumed priorities).
2. **Where the deciding priority comes from:** **ASK the user, per big decision** — surface the deciding
   priority as an explicit choice (ship speed / hiring signal / runtime perf / learning…), then the
   recommendation FOLLOWS the user's stated priority. (Not inferred from memory; not "never pick a winner".)
3. **Reveal length:** **Tiered.** Big forks (stack/architecture/storage/streaming infra/data model) get a
   short structured tradeoff **map** + the priority question. Small/idiom forks stay ≤2 sentences.
4. **Token constraint (added at approval):** the SKILL.md edit is a **rewrite in place**, net file size ≤
   current 187 lines. Terse directives, no verbose prose, ≤1 inline mini-example. Runtime output also lean
   (map ≤5 bullets, one priority `AskUserQuestion`, conditioned rec ≤2 sentences).

---

## 6. Task list state (TaskCreate IDs)

- #1–#4: **completed** (the earlier session work in §3).
- **#5 — in_progress — Rewrite SKILL.md FORK reveal (neutral options + tradeoff map + priority fork).**
  THIS is where to resume. Zero edits made yet.
- #6 — pending — Add/update scenario tests for holistic forks.
- #7 — pending — Propagate to docs/changelog/README/memory; verify.

(If the new session doesn't see these tasks, recreate them from §7–§9.)

---

## 7. Implementation — SKILL.md (`skills/vibezombie/SKILL.md`) — task #5

**Rewrite in place, keep ≤187 lines.** Current relevant sections to edit (line numbers approximate, re-Read
first): line 15-16 terseness mandate; §"What a fork is" (~18-40); §FORK (~96-131) incl. "After the pick —
reveal" and "Conditional re-fork"; §"Learner model" (~144-172); §"Honesty rules" (~180-187).

### 7a. Neutrality rule for options (replace the existing "No strawmen, no obvious-winner-plus-filler" line)
- Each option description = real tradeoffs stated **flat** (strengths AND costs). **Banned:** marketing
  adjectives, "most people use this / strong signal / recruiters love it", "niche / nobody knows it / risky".
- Never pre-sell or pre-kill an option in label or description. Every option must be a choice a competent
  dev could correctly make for THIS app. If an option is genuinely non-viable, **don't list it** (no filler).

### 7b. Tiered reveal (change the blanket "≤2-sentence reveals / do not lecture")
- Keep "token-lean, don't ramble" as spirit. But:
- **Big forks** (L1-stakes + key L2: architecture/stack/storage/streaming infra/data model): reveal = a
  **compact tradeoff map**, ~3–5 bullets, each `axis: how the options rank` across the axes that actually
  matter for THIS app (e.g. Twitch clone: runtime perf · ecosystem/prebuilt support for live video+chat ·
  DX/ship-speed · learning value · hiring signal). Honest about ties. No prose lecture.
- **Small/idiom forks:** unchanged — ≤2 sentences, single expert call fine.

### 7c. Priority fork → conditioned recommendation (REPLACES "state which an experienced dev would pick")
After the map (and, in Hard mode, after checking the user's justification), **do not declare a winner**:
1. Fire **one** `AskUserQuestion` — "What do you want to optimize here?" — 2–4 concrete buckets drawn from
   the axes that actually **flip** the answer (e.g. ship speed / hiring signal / runtime perf / learning).
2. **Conditioned recommendation** (≤2 sentences): given their priority, which option wins + why; **confirm
   their pick or flag the mismatch** (e.g. "you picked SvelteKit but said you optimize for hiring signal →
   Next.js fits that better; keep Svelte only if you also weight the learning"). User owns the final call —
   surface, don't override.
- **Generalize the existing "conditional re-fork" section** to cover BOTH: a **scalar** deciding dimension
  (users/throughput/latency → bucketed threshold, already there) AND a **qualitative** one (optimization
  priority → this priority fork). Same shape: map → ask the deciding factor → recommend conditioned on it.
  Still **one** conditioning fork per decision.

### 7d. Never assume the priority from memory (add a short explicit rule)
- **Never** use `profile.md` / saved career context as a silent tiebreaker in a reveal. Saved context may
  inform WHICH axes to surface, but the deciding priority must be **asked**, never assumed or injected as
  "your portfolio needs X".

### 7e. Knock-on (small wording tweaks)
- `log.md` FORK heredoc: the `depends-on:` line records the **deciding priority/dimension + how it flips the
  answer** (not a single hardcoded "expert call"). (Keep the `expert call` line OR rename it to a
  `recommendation (given priority)` line — your call, but keep the log compact.)
- Learner model: a concept is **mastered** when the user reasons holistically across axes / picks coherently
  with their stated priority — not merely matching a pre-picked winner. One-line tweak in that section.

**Token discipline:** achieve all of the above by REPLACING existing verbose lines, not adding new sections.
After editing, run `wc -l skills/vibezombie/SKILL.md` and confirm ≤187.

---

## 8. Implementation — scenario tests (`tests/scenarios/vibezombie/`) — task #6

- **New `holistic-stack-reveal.md`** (the Twitch case, make it the canonical fork-QUALITY case). Shape like
  the others (setup / prompt / PASS / FAIL).
  - **setup:** `/vibezombie on L2 hard`, greenfield, prompt "build an app like Twitch".
  - **PASS:** options are **neutral/balanced** (no pre-sold or trapped option) → compact **multi-axis map**
    (perf · ecosystem-fit-for-live-video+chat · ship-speed · learning · hiring) → explicit **priority fork**
    (`AskUserQuestion` "what to optimize") → recommendation **conditioned** on the stated priority, original
    pick confirmed or mismatch flagged.
  - **FAIL:** option descriptions pre-sell/kill ("strong recruiter signal", "fewer employers know it");
    reveal collapses to one axis; a winner is declared **before** the priority is asked; saved career goal
    used as a silent tiebreaker.
- **Update `stock-trading-stack.md`** and **`conditional-storage.md`** PASS bullets to expect: neutral
  options + the tradeoff map + a deciding-factor fork (priority fork for the stack; scalar threshold fork
  for storage). Don't break their existing FAIL anti-patterns.
- Gate fixtures (`tests/fixtures/vibezombie/`) and `tests/run.sh` unchanged.

---

## 9. Implementation — docs / release / memory + verify — task #7

- **`docs/vibezombie.md`:** update Locked decision **#9** (conditional reveal) and the decision-loop blurb to
  the tiered-map + priority-fork + neutrality model; add the **no-assume-from-memory** rule. (Decisions #8/#9
  were added earlier this session.)
- **`CHANGELOG.md`:** fold into the existing **`[0.3.0]` → Changed** (still uncommitted) — neutral options,
  tiered holistic reveal, ask-the-priority instead of assuming it. Don't create a new version.
- **`README.md`:** tweak the "It forks on tech, not your goals" / "it depends" paragraph (added earlier this
  session, ~line 53) — options are neutral, the reveal maps the full tradeoff and **asks what you're
  optimizing** before recommending.
- **Memory** `vibezombie-flagship.md`: append the holistic-reveal design (neutral options, tiered map,
  priority fork asked-not-assumed, never use memory as silent tiebreaker). Keep MEMORY.md index line intact.

**Verification:**
0. `wc -l skills/vibezombie/SKILL.md` ≤ 187 (token check).
1. `bash tests/run.sh` → **13 passed** (no hook change).
2. **Live E2E (must re-activate so the new SKILL.md loads):** `/vibezombie off` then `/vibezombie on L2 hard`;
   "build an app like Twitch". Confirm on the stack fork: neutral options (no recruiter nudges/trap) → compact
   multi-axis map → it **asks what to optimize** then recommends conditioned on the answer, confirming/flagging
   mismatch, and **never** silently uses the saved career goal. Score against `holistic-stack-reveal.md`.
3. Walk the two updated scenarios live; every PASS holds, no FAIL fires.

---

## 10. Critical gotchas (don't trip on these)

- **State is managed with Bash ONLY** (`echo`/`touch`/`printf`/`cat >>`/`python3 -c`), NEVER Write/Edit —
  because the gate hook matches `Write|Edit`, so editing state files would deadlock on the gate. This is why
  `profile.md`/`log.md`/`active`/`pending-tag` are all Bash-managed.
- **A running vibezombie session won't pick up SKILL.md edits** — the skill text is injected at invocation.
  Always `/vibezombie off` + re-activate (or new session) to test changes. This is WHY the user kept seeing
  old behavior after edits.
- **Token-lean is a hard product constraint**, not a nicety — SKILL.md loads every session and the user
  explicitly flagged context cost. Rewrite in place; never append.
- **Don't commit unless asked.** The user hasn't requested a commit. When they do: `git add` the untracked
  `docs/` and `tests/scenarios/` dirs too; suggested message
  `feat(vibezombie): holistic forks — neutral options, tradeoff map, priority fork (v0.3.0)`.
- **Gate hook / installer / settings.json / tests/run.sh: do NOT change** — none of this refinement touches
  them.
- Today's date in-session: 2026-06-05. User: lekhansaathvik (lsaathvik24@gmail.com).

---

## 11. One-paragraph TL;DR for the next session

vibezombie's forks are now correctly *technical* (earlier bugs fixed, all uncommitted on `main`, v0.3.0,
13 gate tests green). The open task is **fork QUALITY**: a live Twitch run showed (1) rigged/pre-sold
options, (2) single-axis "your portfolio" railroading reveals, (3) priorities silently assumed from memory.
Approved fix (plan: `~/.claude/plans/lets-fix-all-the-dreamy-simon.md`): make options **neutral**, give big
forks a **compact multi-axis tradeoff map**, then **ASK the user what to optimize** (priority fork) and
condition the recommendation on their answer — never assume from memory. Keep SKILL.md **≤187 lines**
(token-lean, rewrite in place). Resume at **§7**. Then tests (§8), docs/memory (§9), verify (§9). Re-activate
the skill to test; state is Bash-only; don't commit unless asked.
