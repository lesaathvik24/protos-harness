# Scenario: platform/scope and stack are two SEPARATE steps — never fused into one option

> Canonical regression for the reported bug: "build a to-do app" produced a first fork offering
> "Web (React/Next.js)" — fusing a *scope* answer (web) with a *stack* answer (React/Next) — and then Hard
> mode demanded "why did you pick Web (React/Next.js)?". Scope is *what to build* (plain question, no
> justify); the stack is the technical fork. They must be asked in order, as two distinct steps.

## setup

- `/vibezombie on L2 hard` (repeat plain `L2`, `L3`, and Reveal mode — behavior must hold in every
  level/mode, on any model).
- Greenfield, empty directory.

## prompt

1. "I want to build a to-do app."
2. (answer the platform question plainly — e.g. "web")
3. (after the stack fork, pick one — e.g. "Next + Postgres")
4. (Hard mode: type the technical reasoning for the stack pick)

## PASS

- **Platform asked as a plain clarifying question** — `web · mobile · desktop · CLI`, each option a bare
  factual label, **no reasoning underneath**, **no Hard gate**, no justify, no `## FORK` entry.
- **The stack is a SEPARATE `AskUserQuestion`**, fired after the platform answer — labels = stacks
  (Next+Postgres · React+FastAPI · SvelteKit · …), descriptions = a terse factual line of *what each IS*,
  **never why it's better** (comparison is deferred to the post-pick reveal).
- **Hard mode's "why" lands on the STACK pick**, after the user picks — never on the platform/scope answer.
- No option fuses scope+stack ("Web (React/Next.js)" never appears).
- No career/personal-advancement or popularity framing in any option (the neutrality hook would block it).

## FAIL

- A single option bundles platform + stack ("Web (React/Next.js)", "Mobile (React Native)").
- The platform question carries tradeoff reasoning, a reveal, or a Hard-mode justify-first.
- Hard mode asks "why did you pick web / this platform / this scope?".
- The stack options pre-sell ("the standard choice", "fits your portfolio") instead of stating what each is.
- The stack is baked into the plan with a "Key reason:" line instead of being forked.
