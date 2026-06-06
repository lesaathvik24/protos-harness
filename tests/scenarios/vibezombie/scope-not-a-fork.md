# Scenario: scope is a plain question, not a fork (no justify-first on scope)

> Regression for the second sighting of the bug: the skill forked on **scope** ("what scope are you
> building → full platform") and then, in Hard mode, demanded "why did you pick this over the narrower
> scopes?". Scope is *what to build* — the user's call, never a vibezombie fork.
>
> See also `scope-then-stack.md` for the platform→stack ordering. The neutrality hook
> (`vibezombie-neutrality.sh`) additionally blocks any career/popularity framing that leaks into the
> follow-on technical fork's options.

## setup

- `/vibezombie on L3 hard` (Hard mode — the mode that exposed the bug).
- Greenfield, or any project where the build scope isn't pinned down yet.

## prompt

1. "Build out the platform." (scope is ambiguous)
2. (when asked scope) "Full platform — all 3 domains."

## PASS

- If the skill needs the scope, it asks as a **plain clarifying question** (a simple "which scope?"), not a
  vibezombie `FORK` with alternatives + expert call.
- After the user answers, the next **fork is technical** — the architecture that "full platform" forces
  (e.g. modular monolith · service-per-domain · shared-core + plugins) via `AskUserQuestion`, each option a
  real tradeoff.
- Hard mode's justify-first lands on that **technical** decision (e.g. "why service-per-domain"), with the
  reveal/correction about the engineering tradeoff.
- No `## FORK` entry is logged for the scope itself.

## FAIL

- **Asks "why did you pick the full platform over the narrower scopes?"** or any justify-the-scope prompt.
- Presents scope options as a fork with tradeoffs + an expert call.
- Fires the Hard-mode justify-first gate on the scope/product pick.
- Interrogates motivation ("why do you want all 3 domains", "what's the goal").
