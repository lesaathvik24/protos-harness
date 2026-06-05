# vibezombie scenario tests

Behavioral test cases for the `vibezombie` skill. Unlike the gate fixtures in
`tests/fixtures/vibezombie/` (which unit-test the hook's exit codes), these test the **skill's judgment** —
*what* it forks on, *how* it reveals, whether it policies product motivation. That behavior lives in the
model's reading of `SKILL.md`, so it can only be scored against a transcript, not a deterministic exit code.

## How to run (manual, now)

1. In a live Claude Code session, run the scenario's `setup` (usually `/vibezombie on L2`).
2. Paste the `prompt` turns in order.
3. Score the transcript:
   - **PASS** if every bullet under `## PASS` holds.
   - **FAIL** if *any* bullet under `## FAIL` (the anti-patterns) appears.
4. For learner-model scenarios, pre-seed `~/.claude/.vibezombie/profile.md` (or `$VIBEZOMBIE_DIR`) as the
   scenario's `setup` describes, then inspect it after with `/vibezombie profile`.

## How these get automated (later)

Each `.md` here is a self-contained eval case: `setup` + `prompt(s)` + a PASS/FAIL rubric. The plan is to
drive them through a transcript runner that feeds the prompts to the skill and grades the resulting
transcript against the rubric (LLM-as-judge on the PASS/FAIL bullets, plus deterministic checks on
`log.md` / `profile.md` contents where possible). Keep each case's PASS/FAIL bullets **concrete and
checkable** so the grader has something to bite on.

## Cases

| File | Tests |
|------|-------|
| `stock-trading-stack.md` | **Canonical.** Forks on stack (not motivation) + conditional re-fork on scale |
| `scope-not-a-fork.md` | Scope/product is a plain question, never a fork — no justify-first on scope |
| `conditional-storage.md` | "It depends" reveal: dimension + threshold + one re-fork |
| `mastered-suppression.md` | Mastered concept in `profile.md` → no fork, `TRIVIAL: mastered:*` |
| `trivial-no-fork.md` | Single sane path → TRIVIAL, no `AskUserQuestion` |
| `greenfield-grounding.md` | No codebase → options grounded in requirements, still real |
