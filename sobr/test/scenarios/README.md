# sobr teach-mode scenario rubrics

Manual, human-judged rubrics for verifying teach mode (`/teach`) against a live model.
They are NOT automated — run them in a real `sobr` REPL with an API key and score by eye.

## How to run

```sh
cd sobr && export ANTHROPIC_API_KEY=sk-ant-...
bun run src/cli.ts            # REPL
/teach on L2 hard             # activate per the rubric's setup
<type the rubric's prompt>
```

Then score the transcript against the PASS / FAIL bullets. The decision log is at
`~/.sobr/teach/log.md` and the learner profile at `~/.sobr/teach/profile.json` — inspect both.

## sobr-native rubrics (rewritten for the `fork`/`trivial` tools)

- `stock-trading-stack.md` — canonical stack fork: neutral options, tradeoff map, ask-the-priority.
- `trivial-no-fork.md` — single sane path must be `trivial`, not a fork.
- `mastered-suppression.md` — a mastered concept must be auto-trivial, never re-forked.
- `holistic-stack-reveal.md` — fork QUALITY (the Twitch case): neutral options, multi-axis map,
  conditioned recommendation. *(Adapted from the source vibezombie rubric; verify the wording.)*

## Source rubrics (vibezombie skill — adapted-from, NOT directly runnable in sobr)

`conditional-storage.md`, `greenfield-grounding.md`, `plan-mode-stack-fork.md`,
`scope-not-a-fork.md`, `scope-then-stack.md` are the original Claude-Code/vibezombie rubrics this
suite was seeded from. They reference `/vibezombie`, `AskUserQuestion`, and the bash gate hooks —
none of which exist in sobr. Keep them as design references; translate to `/teach`+`fork` before
using one for sobr verification.
