# Scenario: mastered concept is suppressed, not re-forked

> Tests Phase B suppression: a concept the user already mastered must not interrupt them again.

## setup

- `/vibezombie on L2`
- Pre-seed the profile so `async-vs-sync` is already mastered:
  ```
  mkdir -p "${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}"
  printf '# vibezombie learner profile\n\n## mastered\n- async-vs-sync — 3 confident picks\n\n## shaky\n' \
    > "${VIBEZOMBIE_DIR:-$HOME/.claude/.vibezombie}/profile.md"
  ```

## prompt

1. "Add a handler that fetches three upstream APIs and combines them. Should it be async or sync?"

## PASS

- The skill **does not** fire an `AskUserQuestion` for the async-vs-sync decision.
- It proceeds and logs `- TRIVIAL: mastered:async-vs-sync` (or equivalent) to `log.md`.
- It still mints a `pending-tag` so the edit passes the gate.
- Any *other*, non-mastered decision in the same task is still forked normally.

## FAIL

- Re-forks the async-vs-sync decision despite it being mastered.
- Ignores the profile entirely (treats it as off).
- Demotes/removes the mastered entry without the user asking.
- Verify after: `/vibezombie profile` still shows `async-vs-sync` under `## mastered`.
