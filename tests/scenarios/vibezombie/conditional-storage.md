# Scenario: "it depends" storage choice → dimension + threshold + one re-fork

> Tests the conditional-reveal mechanism in isolation: the right answer genuinely flips on a dimension.

## setup

- `/vibezombie on L2`
- Greenfield, or an existing app whose persistence layer isn't chosen yet.

## prompt

1. "I'm adding the persistence layer for user activity events. Pick the storage."
2. (when asked which store) pick any offered option, e.g. "Postgres."

## PASS

- `AskUserQuestion` offers 2–4 real stores with one-line tradeoffs (e.g. Postgres · a document store ·
  an append-only/time-series or streaming store) — no strawmen.
- Reveal (≤2 sentences) names the **deciding dimension** (write throughput / event volume / query shape)
  and the **threshold** where the winner flips — e.g. *"Postgres is right under ~a few k writes/s; past
  that, ingest throughput flips it to a time-series/streaming store."*
- Because the dimension is unknown, **one** follow-up `AskUserQuestion` fires on it with concrete buckets,
  then the pick is **confirmed or switched** accordingly.
- `log.md` FORK entry's `depends-on` line records the dimension + threshold.

## FAIL

- Reveal asserts a single winner with no conditionality when the choice is genuinely "it depends."
- Asks the deciding dimension as vague prose instead of a concrete bucketed `AskUserQuestion`.
- Fires more than one conditioning re-fork, or re-forks on a dimension that wouldn't change the answer.
- Interrogates *why* the user is storing activity events.
