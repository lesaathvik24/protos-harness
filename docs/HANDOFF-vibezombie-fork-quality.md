# HANDOFF — vibezombie fork-QUALITY: career-context contamination (UNRESOLVED)

> Self-contained pick-up doc for the next session. The "holistic forks" refinement was implemented and
> committed, but **live testing exposed a deeper, still-OPEN bug**: fork options keep leaking the user's
> career profile, and the plan-mode rule is being ignored — **on Opus too, not just Sonnet, with the latest
> skill loaded**. Read top-to-bottom. The open work starts at §6.

---

## 1. What this project is

- **Repo:** `protos-harness`, working dir `~/Downloads/claude-harness`, branch `main`, git user `lesaathvik24`.
- **`vibezombie`** is the user's flagship original skill and the public, demo-able ship gating their job
  applications (SDET → AI/ML/SWE pivot). Hard constraints: **recruiter-legible** + **token-lean**
  (`SKILL.md` loads every session, must stay **≤187 lines**).
- Realtime anti-vibecoding coach: at each meaningful **technical** decision it surfaces genuine alternatives
  via `AskUserQuestion`, makes the user own the pick, then writes code. A `PreToolUse(Write|Edit)` hook
  (`hooks/vibezombie-gate.sh`) blocks untagged edits. Decisions append to `~/.claude/.vibezombie/log.md`.
- **Canonical docs:** `docs/vibezombie.md` (architecture/status), `docs/HANDOFF-vibezombie-holistic.md`
  (the PRIOR handoff — describes the holistic refinement that this session implemented).
- **Memory:** `~/.claude/projects/-Users-lekhansaathvik-Downloads-claude-harness/memory/vibezombie-flagship.md`.

---

## 2. Conversation arc this session (user input → my output)

1. **User:** "implement [the existing] handoff doc fully; analyse current state first; spin up agents."
   **Me:** Read `docs/HANDOFF-vibezombie-holistic.md`. Confirmed §3 work was already committed (`e1a05b8`).
   Implemented the holistic-forks refinement (§7–§9): rewrote `SKILL.md` (neutral options, tiered tradeoff
   map, ask-the-priority fork, never-assume-from-memory), used two builder agents for scenario tests +
   docs/changelog/README/memory. Verified 187 lines, 13/13 gate tests. → commit `9024294`.
2. **User:** "yes commit. is the github issue resolved? are you 100% sure it's perfect?"
   **Me:** Committed. Said no GitHub issue was visible (gh not authed). Was explicit: behaviorally
   **unverified** — `SKILL.md` is a prompt-contract; only a live re-activated run proves it.
3. **User:** pasted a live run — "build a betting app" → the plan **pre-decided the whole stack** with
   pre-selling ("Next.js — Portfolio-standard") and deferred forks to "during build". "y did it assume the
   stack… i told u fix this." Also asked about `gh login` and "how can you push without gh login".
   **Me:** Diagnosed the **plan-mode-not-an-exemption** bug. Added an imperative plan-mode rule to
   `SKILL.md` + scenario `plan-mode-stack-fork.md` + docs locked-decision #10. → commit `e7f17d4`.
   Also **flagged a leaked GitHub PAT** in the remote URL (see §8); explained commit ≠ push and that gh
   auth ≠ git push auth.
4. **User:** another run (prediction markets / LMSR) — options STILL pre-sold ("Polymarket all use it",
   "Standard SWE portfolio target", "showcase Python/data skills"). "i told u fix this mannnn."
   **Me:** Diagnosed phrase-blocklist whack-a-mole. Replaced with a **categorical** ban (popularity + career
   framing, any phrasing). → commit `4b802a4`. Told user a running session won't pick up edits → must
   `/vibezombie off` then `on`.
5. **User:** did the proper `off`→`on` reload, ran "betting app" → **still** leaked ("aligns with your ML
   background", "showcases best").
   **Me:** Identified the **true root cause**: the user's career profile lives in `~/.claude/CLAUDE.md`
   ("Context: lekhansaathvik" — ML background, portfolio ship), is in context **every** session, and the
   model keeps surfacing it. Reframed the rule: "write each option for an **anonymous engineer — pretend
   you don't know who the user is**"; named CLAUDE.md as the #1 contaminant. → commit `e63e76c`.
6. **User:** pasted two runs of the latest skill: **Sonnet** (options 1–3 fully technical — "SSR conflicts
   with realtime", "vendor dependency", "boilerplate"; only residual = "hiring signal" in option 4) and
   **Opus** ("fits the portfolio-ship rule", "closer to your AI/ML trajectory", **plus** "Forks will fire
   during implementation, not in the plan").
   **Me (WRONG):** claimed the Opus run was a **stale** skill.
7. **User (correction — IMPORTANT):** "**the opus one wasn't stale btw**." Asked for this handoff +
   "commit everything." → this doc.

---

## 3. Git state

Origin is behind — **branch is `ahead 5`** of `origin/main` (origin/main = `c37c1c8`). **Nothing pushed**
(intentionally — see token leak §8). Commits this session, newest first:

```
e63e76c fix(vibezombie): name the real contaminant — CLAUDE.md career profile leaks into options
4b802a4 fix(vibezombie): categorical ban on popularity + career framing in fork options
e7f17d4 fix(vibezombie): plan mode is not an exemption — fork the stack before the plan commits
9024294 feat(vibezombie): holistic forks — neutral options, tradeoff map, priority fork (v0.3.0)
e1a05b8 feat(vibezombie): technical-only forks, conditional reveals + Phase B learner model (v0.3.0)  [pre-session]
```

Working tree clean except untracked `.claude/` (local noise) and this handoff (commit it).

---

## 4. What was implemented & verified (mechanics work)

- `skills/vibezombie/SKILL.md` — rewritten in place, **187 lines**. Now contains: neutral-options categorical
  ban (popularity + ALL career framing, "anonymous engineer" framing, names CLAUDE.md as #1 contaminant);
  tiered reveal (compact multi-axis tradeoff map for big forks, ≤2 sentences for small); ask-the-deciding-
  factor fork (qualitative priority OR scalar threshold) → conditioned recommendation; never-assume-priority;
  **plan-mode-is-not-an-exemption** rule; Hard mode; learner model; gate protocol.
- Scenario rubrics in `tests/scenarios/vibezombie/`: added `holistic-stack-reveal.md` and
  `plan-mode-stack-fork.md`; updated `stock-trading-stack.md`, `conditional-storage.md`.
- `docs/vibezombie.md` (locked decisions #6/#9/**#10** + decision-loop blurb), `CHANGELOG.md` (`[0.3.0]`
  Changed), `README.md` (forks-on-tech paragraph), memory file — all updated.
- **Verified:** `wc -l skills/vibezombie/SKILL.md` → 187; `bash tests/run.sh` → **13 passed**.

---

## 5. The latest skill's exact runtime output (evidence)

**Sonnet (mostly fixed):**
```
1. Next.js + Postgres + Prisma — Con: SSR mental model conflicts with real-time price feeds; API routes messy.
2. React + Node/Express + Postgres — Con: more boilerplate; you own the auth/session layer yourself.
3. Next.js + Supabase — Con: Supabase Realtime adds a vendor dependency; local dev needs supabase CLI.
4. SvelteKit + Drizzle — Con: smaller ecosystem; harder to find hiring signal / examples.   ← residual leak
```

**Opus (NOT stale — still fails on BOTH axes):**
```
1. Next.js + Postgres — Full-stack TS, Vercel-deployable, fits the portfolio-ship rule. Familiar territory.  ← career leak
2. FastAPI + React — Python backend (closer to your AI/ML trajectory), separate frontend.                    ← career leak
3. You decide — Pick what fits the chosen domain + target best.
"No codebase to explore — greenfield. I'll write the plan now. Forks will fire during implementation, not in the plan."  ← VIOLATES locked decision #10
```

---

## 6. THE OPEN BUG (start here)

With the **latest** `SKILL.md` (`e63e76c`) loaded:

- **(A) Career-context contamination persists** — even on Opus. Options/reveals still surface the user's
  CLAUDE.md career profile ("fits the portfolio-ship rule", "closer to your AI/ML trajectory", residual
  "hiring signal"). The categorical ban + "anonymous engineer" reframe **reduced** it (Sonnet ~90% clean)
  but did **not eliminate** it.
- **(B) Plan-mode rule (#10) is ignored** — even on Opus: "Forks will fire during implementation, not in the
  plan" is the exact deferral #10 forbids, and the stack was NOT forked via `AskUserQuestion` before the
  plan. So the plan-mode fix is not binding in practice.

**Corrected conclusion (the stale-skill theory was WRONG):** prompt-level rules in `SKILL.md` are **not
sufficient** to override the always-on `~/.claude/CLAUDE.md` career context, on **either** model. You cannot
reliably instruct a model to ignore high-salience info that is sitting in its own context window, and the
gate hook **cannot** enforce fork-quality (it only guards `Write|Edit` — it never sees `AskUserQuestion`
options or `ExitPlanMode` plans). This is a structural limit, not a wording problem.

---

## 7. Recommended next steps (in priority order)

1. **Structural fix — remove the contaminant at the source.** Relocate the "## Context: lekhansaathvik"
   career block OUT of always-on `~/.claude/CLAUDE.md` (e.g. into a file the model only reads for explicit
   career tasks). If the career profile isn't in context, **no model can leak it** — the only model-agnostic
   guarantee. **Tradeoff:** the model won't auto-know the user's career goals in normal sessions (they'd
   state them when relevant). *User was asked to choose this vs. retest-first vs. add-version-marker but
   deferred — re-offer.*
2. **Make the plan-mode rule actually bind.** Options to explore: (a) move the plan-mode fork instruction to
   the very TOP of `SKILL.md` (high-salience), (b) a `PreToolUse(ExitPlanMode)` gate that blocks a plan
   while `active` unless a stack `FORK` was logged (note: brittle, and the prior handoff said don't touch
   the hook — get user sign-off), (c) accept it's prompt-only and strengthen wording again.
3. **Add a version/build marker** to `SKILL.md` + the activation confirmation so the user can SEE which
   version is loaded — this session burned a lot of trust on stale-skill confusion (which turned out to be
   wrong for the Opus run anyway). Low cost, ends the ambiguity.
4. **Re-run the behavioral scenarios** (`holistic-stack-reveal.md`, `plan-mode-stack-fork.md`) on both Opus
   and Sonnet after any change, and score honestly.

Do **not** keep wordsmithing the ban list alone — it has hit diminishing returns (already tried phrase-list →
categorical → name-the-source; still leaks).

---

## 8. Open NON-skill items (carry these forward)

- **🔴 LEAKED GITHUB PAT — revoke immediately.** The remote URL embeds a token in cleartext:
  `https://lesaathvik24:ghp_…@github.com/lesaathvik24/protos-harness.git` (full token is in `.git/config`
  and was surfaced in this session). Revoke at github.com/settings/tokens, then scrub:
  `git remote set-url origin https://github.com/lesaathvik24/protos-harness.git`. **Do not push until rotated.**
- **gh not authenticated.** User started `! gh auth login` but interrupted it. Needed for issue/PR access.
- **"There's an issue raised."** The user says a GitHub issue exists; it could NOT be read (no gh auth, no
  URL given). Get the issue number/URL or have them auth, then read it — it may reframe the work.
- **5 unpushed commits.** Hold until the PAT is rotated; then `git push` (after scrubbing the URL).

---

## 9. Critical gotchas

- **State is Bash-only** (`echo`/`touch`/`printf`/`cat >>`/`python3 -c`), NEVER Write/Edit — the gate hook
  matches `Write|Edit`, so editing state files (`log.md`/`profile.md`/`active`/`pending-tag`) would deadlock.
- **A running vibezombie session does NOT pick up `SKILL.md` edits** — the text is injected at activation.
  Always `/vibezombie off` + `/vibezombie on …` to load changes. (True — but note it was NOT the cause of the
  Opus failure in §6; that was real non-compliance.)
- **`SKILL.md` ≤187 lines is a hard, locked constraint** (loads every session). Rewrite in place; offset any
  addition with a trim. Re-check with `wc -l` after every edit.
- **The gate hook can't enforce fork QUALITY** — it never sees `AskUserQuestion`/`ExitPlanMode`. All
  fork-quality + plan-mode behavior is prompt-only, which is exactly why §6 is hard.
- Today's date in-session: 2026-06-05. User: lekhansaathvik (lsaathvik24@gmail.com). Tests on Sonnet AND Opus.

---

## 10. One-paragraph TL;DR

The holistic-forks refinement is implemented and committed (`9024294`, `e7f17d4`, `4b802a4`, `e63e76c`;
187-line `SKILL.md`, 13/13 gate tests). But live runs of the **latest** skill still fail: fork options leak
the user's CLAUDE.md career profile ("fits the portfolio-ship rule", "hiring signal") and the plan-mode rule
(#10) is ignored ("forks will fire during implementation") — **on Opus too, not just Sonnet** (my earlier
"stale skill" claim was wrong, per the user). Root cause is structural: a `SKILL.md` prompt cannot reliably
override the always-on `~/.claude/CLAUDE.md` career context, and the gate hook can't enforce fork quality.
**Leading fix: relocate the career block out of always-on CLAUDE.md** (re-offer to the user), make the
plan-mode rule higher-salience or hook-enforced, and add a version marker. Separately: a **leaked GitHub PAT**
in the remote URL must be revoked before any push (5 commits unpushed), gh isn't authed, and there's a
user-mentioned GitHub issue still unread.
