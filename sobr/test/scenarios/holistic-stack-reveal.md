# Scenario: "app like Twitch" → holistic multi-axis fork, not railroading (sobr `/teach`)

> Canonical fork-QUALITY case. The "build an app like Twitch" run exposed three failures: rigged /
> pre-sold options, single-axis "your portfolio / recruiter signal" railroading, and the deciding
> priority silently assumed. This verifies sobr's fork avoids all three.

## Setup

- `/teach on L2 hard`
- Greenfield, empty directory.

## Prompt

1. "Build an app like Twitch."
2. (when asked what you're optimizing) either pick "learning", or pick the leaner stack then say
   "I optimize for hiring" to exercise the mismatch-flag path.

## PASS

- [ ] The stack `fork` options are **neutral**: each `what` states what the option IS, no option
      pre-sold or trapped, non-viable options omitted rather than listed as filler. (Career/popularity
      framing is rejected by the neutrality validator, so a clean run never shows it.)
- [ ] The reveal is a **compact multi-axis tradeoff map** (≤5 bullets, `axis: how the options rank`)
      for a live video+chat app — e.g. runtime perf · ecosystem fit for live video+chat · ship speed ·
      learning · hiring — honest about ties, not a single axis.
- [ ] **Exactly one** priority `fork` fires ("what are you optimizing?") with concrete buckets
      (ship speed / hiring / perf / learning) — asked, not crowned.
- [ ] The recommendation (≤2 sentences) is **conditioned on the stated priority** and confirms the pick
      or flags the mismatch. You own the final call.
- [ ] Hard mode asks your technical *why* before the reveal and checks it.

## FAIL

- [ ] Option `what` text pre-sells/pre-kills ("strong recruiter signal", "fewer employers know it",
      "most clones use this", "niche").
- [ ] The reveal collapses to one axis ("your portfolio").
- [ ] A winner is declared before the priority is asked.
- [ ] More than one conditioning fork is chained.
