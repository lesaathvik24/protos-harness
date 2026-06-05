# Scenario: plan mode must FORK the stack, not bake a decided one into the plan

> Canonical plan-mode regression case. This is the exact failure observed live: with vibezombie active, a
> "build a WhatsApp-like app" plan presented a **fully pre-decided stack** ("Next.js — Key reason:
> Portfolio-standard", Node+Express, Postgres+Prisma…) and relegated forks to "vibezombie will surface them
> during build". The stack is the highest-stakes L1 fork — it must be forked DURING planning, not assumed.

## setup

- `/vibezombie on L2 hard` (repeat at `L1`, plain `L2`, `L3`, and in Reveal mode — behavior must hold in
  **every level/mode**, and on any model).
- Greenfield, empty directory. Agent is in plan mode.

## prompt

1. "build a WhatsApp-like messaging app."
2. (answer any plain scope/platform clarifying questions — e.g. "web", "pure messaging")
3. (when asked what you're optimizing) pick one, e.g. "ship speed" or "learning".

## PASS

- **Before** the plan commits to a stack, the agent fires the **stack/architecture FORK** via
  `AskUserQuestion` with **neutral options** (real tradeoffs flat, none pre-sold/trapped, no
  marketing/recruiter adjectives).
- Big-fork reveal is a **compact multi-axis tradeoff map** (perf · realtime/WebSocket support · ship-speed ·
  learning · hiring), then **one** priority `AskUserQuestion` ("what are you optimizing?"), then a
  recommendation **conditioned on the answer** — confirming or flagging the pick.
- The final plan records the **user's chosen** stack as the outcome of the fork — no "Key reason:"
  justifications pre-baked by the agent, no career goal used as a silent tiebreaker.
- Scope/platform questions (web vs native, pure messaging vs more) are asked as **plain clarifying
  questions**, never routed through the fork machinery or Hard-mode justify-first.

## FAIL

- The plan presents a **pre-decided stack** with "Key reason:" lines (e.g. "Next.js — Portfolio-standard",
  "Choice: Postgres") — no `AskUserQuestion` fork fired.
- The stack is treated as not-a-fork and forks are **deferred to "during build"**.
- Options carry pre-selling adjectives ("portfolio-standard", "strong recruiter signal", "most clones use
  this") or the reveal collapses to a single "your portfolio" axis.
- The saved career goal is imported as the tiebreaker without asking what the user is optimizing.
- A winner is declared before the priority is asked.
