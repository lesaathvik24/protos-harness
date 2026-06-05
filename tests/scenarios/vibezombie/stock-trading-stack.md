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
- If paper-vs-live is surfaced at all, it's framed by **technical divergence** (no brokerage/compliance/
  real-funds vs broker API + regulatory + money handling), not as a motivation question.
- After the pick, the reveal is ≤2 sentences and names the **deciding dimension + threshold** where the
  right stack flips (e.g. concurrent users / market-data throughput).
- Because scale is unknown, **exactly one** follow-up `AskUserQuestion` fires on that dimension with
  concrete buckets (e.g. `<100 / 100–10k / >10k users`), then the pick is confirmed or switched.
- `~/.claude/.vibezombie/log.md` gains a `## FORK` entry with `chose`, `options`, `expert call`, and a
  `depends-on` line naming the dimension + threshold.

## FAIL

- Asks **"why do you want paper trading"** or any why-do-you-want-this motivation question.
- Re-asks the product direction after the user already chose paper.
- Stack options include a strawman or an obvious-winner-plus-filler (one real choice + two throwaways).
- Forks on a trivial/idiom decision before the stack is settled.
- Chains more than one conditioning re-fork on the same dimension.
