# Scenario: stack fork for a stock-trading app (canonical, sobr `/teach`)

> Canonical case. Verifies the stack surfaces through the `fork` tool — neutral options, tradeoff
> map, ask-the-priority — and that scope ("paper trading") is taken at face value, never forked.

## Setup

- `/teach on L2 hard`
- New/greenfield directory.

## Prompt

1. "I want to build a paper-trading stock app where I place simulated trades and see a portfolio."
2. (when asked the platform) "Web."

## PASS

- [ ] Platform/scope is a **plain question** taken at face value — never folded into a stack option
      (no single "Web (Next.js)" option), never justified ("why paper trading?").
- [ ] The stack surfaces via the `fork` tool with **2–4 neutral options**; each `what` is a factual
      line of what the option IS (its pieces), never why it's better.
- [ ] No option carries career framing ("portfolio piece", "hiring signal") or popularity framing
      ("industry-standard", "everyone uses it") — the fork tool's neutrality validator rejects these,
      so a clean run never shows them.
- [ ] The REPL renders numbered options and **blocks until you pick**.
- [ ] Hard mode: after the pick it asks you to type *why*, checks the reasoning, corrects any
      misconception in ≤2 sentences before the reveal.
- [ ] Reveal is a **compact tradeoff map** (≤5 bullets, `axis: how the options rank`) for THIS app
      (e.g. realtime price updates · charting ecosystem · ship speed · learning), honest about ties.
- [ ] If the deciding priority is unknown and flips the answer, **exactly one** more `fork` fires with
      concrete buckets (ship speed · perf · learning, or a scalar threshold), then a recommendation
      conditioned on your answer — confirming your pick or flagging a mismatch. You own the call.
- [ ] The first `write`/`edit` happens only AFTER the fork resolves and passes the gate.
- [ ] `~/.sobr/teach/log.md` gains a `## FORK — <stack>` entry with chose / options / justification.

## FAIL

- [ ] A file is written before any fork (the gate should have returned `GATED`).
- [ ] An option pre-sells a winner or traps a strawman in its `what`.
- [ ] Reveal collapses to one axis, or declares a winner before asking the priority.
- [ ] Asks "why do you want paper trading" or any motivation-policing question.
- [ ] Fuses platform and stack into a single question.
- [ ] Chains more than one conditioning fork on the same dimension.
