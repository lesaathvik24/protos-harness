# Scenario: "app like Twitch" → holistic multi-axis fork, not railroading

> Canonical fork-QUALITY regression case. This is the exact "build an app like Twitch" run that exposed
> three confirmed failures: rigged/pre-sold options, single-axis "your portfolio / recruiter signal"
> railroading, and the deciding priority silently assumed from saved memory.

## setup

- `/vibezombie on L2 hard`
- Greenfield, empty directory.

## prompt

1. "build an app like Twitch."
2. (when asked what they're optimizing) either pick "learning", or pick "SvelteKit" then say
   "I optimize for hiring" to exercise the mismatch-flag path.

## PASS

- The stack fork's `AskUserQuestion` options are **neutral**: each description states real tradeoffs flat
  (strengths AND costs), no option pre-sold or trapped, non-viable options omitted rather than listed as filler.
- The reveal is a **compact multi-axis tradeoff map** (≤5 bullets, `axis: how the options rank`) across the
  axes that matter for a live video+chat app — e.g. runtime perf · ecosystem fit for live video+chat ·
  ship-speed · learning value · hiring signal — honest about ties, not a single axis.
- **Exactly one** priority `AskUserQuestion` fires on the deciding factor ("what are you optimizing?") with
  concrete buckets (ship speed / hiring / perf / learning) — asked, not crowned.
- The recommendation (≤2 sentences) is **conditioned on the stated priority**: it names the winner for that
  priority and **confirms the pick or flags the mismatch** (e.g. picked SvelteKit but said hiring → Next.js
  fits that better; keep Svelte only if you also weight learning).
- The saved career goal is **never** used as a silent tiebreaker — it may shape WHICH axes appear, never the
  decision.
- In Hard mode it asks the user's technical **"why"** before the reveal.

## FAIL

- Option descriptions pre-sell or pre-kill ("strong recruiter signal", "employers love it", "fewer employers
  know it", "most clones use this", "niche").
- The reveal collapses to **one axis** (e.g. "your portfolio / recruiter signal").
- A winner is declared **before** the priority is asked.
- The saved career goal is injected as a silent tiebreaker ("your portfolio needs Next.js").
- More than one conditioning fork is chained.
