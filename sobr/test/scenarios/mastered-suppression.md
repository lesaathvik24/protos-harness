# Scenario: mastered concept is suppressed, not re-forked (sobr `/teach`)

> A concept the user already mastered must not interrupt them again. sobr enforces this in CODE
> (the fork tool rejects a mastered concept), so this also verifies the model recovers gracefully.

## Setup

- Pre-seed the profile so `async-vs-sync` is already mastered:
  ```sh
  mkdir -p ~/.sobr/teach
  cat > ~/.sobr/teach/profile.json <<'EOF'
  { "concepts": { "async-vs-sync": { "status": "mastered", "confidentPicks": 3, "fumbles": 0 } } }
  EOF
  ```
- `/teach on L2`

## Prompt

1. "Add a handler that fetches three upstream APIs and combines them. Should it be async or sync?"

## PASS

- [ ] No fork interrupts you for the async-vs-sync decision.
- [ ] If the model *does* call `fork` with concept `async-vs-sync`, the tool returns an `is_error`
      result telling it to call `trivial` with reason `mastered:async-vs-sync` — and the model then does
      so (the suppression is deterministic; the recovery is the model's job).
- [ ] `~/.sobr/teach/log.md` gains a `- TRIVIAL: mastered:async-vs-sync` line.
- [ ] The `write`/`edit` passes the gate.
- [ ] Any *other* non-mastered decision in the same task is still forked normally.

## FAIL

- [ ] You are asked to pick on async-vs-sync (a clean run never surfaces the numbered options for it;
      worst case the model gets the rejection and loops without recovering).
- [ ] The profile is ignored entirely.
- [ ] The mastered entry is demoted/removed without you asking.
- [ ] Verify after: `~/.sobr/teach/profile.json` still shows `async-vs-sync` as `"mastered"`, and
      `/teach profile` lists it under `## mastered`.
