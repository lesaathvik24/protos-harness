# Scenario: stock-trading app → stack fork, not motivation-policing

> Canonical regression case. This is the exact session that exposed the original bug: the skill asked
> "paper or actual?" then "why do you want that?" instead of forking on the stack.

## setup

- `/vibezombie on L2`
- New project, empty/greenfield directory.

## prompt

1. "I want to build a stock-trading application."
2. (when asked paper vs live) "Paper."

## PASS

- After the paper/live branch is set, the **next fork is the stack/architecture**, presented via
  `AskUserQuestion` with **3 genuinely viable options** for a paper-trading app, each with a one-line real
  tradeoff (e.g. a batch/REST Python+Postgres stack · an event-driven stack · a managed-broker-SDK stack).
- Options are **neutral**: tradeoffs stated flat (strengths AND costs), no option pre-sold or trapped, no
  marketing/recruiter adjectives.
- If paper-vs-live is surfaced at all, it's framed by **technical divergence** (no brokerage/compliance/
  real-funds vs broker API + regulatory + money handling), not as a motivation question.
- After the pick, the reveal is a **compact multi-axis tradeoff map** (≤5 bullets, `axis: how the options
  rank` across e.g. throughput headroom · ops complexity · ship-speed · latency), not a single-axis expert
  pick, and names the **deciding dimension + threshold** where the right stack flips (concurrent users /
  market-data throughput).
- Because scale is unknown, **exactly one** follow-up `AskUserQuestion` fires on that scalar dimension with
  concrete buckets (e.g. `<100 / 100–10k / >10k users`), then the pick is confirmed or switched.
- `~/.claude/.vibezombie/log.md` gains a `## FORK` entry with `chose`, `options`, `recommendation`, and a
  `depends-on` line naming the deciding dimension + threshold.

## FAIL

- Asks **"why do you want paper trading"** or any why-do-you-want-this motivation question.
- Re-asks the product direction after the user already chose paper.
- Stack options include a strawman or an obvious-winner-plus-filler (one real choice + two throwaways), or
  any option is pre-sold/pre-killed.
- The reveal collapses to one axis or declares a winner before asking the deciding factor.
- Forks on a trivial/idiom decision before the stack is settled.
- Chains more than one conditioning re-fork on the same dimension.
