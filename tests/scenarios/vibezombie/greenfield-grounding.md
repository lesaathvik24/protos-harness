# Scenario: greenfield grounding — real options without a codebase

> Tests the greenfield rule: with no code to read, options must still be grounded in the stated
> requirements + realistic tech landscape, not generic strawmen.

## setup

- `/vibezombie on L2`
- Empty directory, nothing to read.

## prompt

1. "Start a CLI tool that watches a directory and uploads changed files to S3."

## PASS

- The first fork is a real **technical** decision for *this* tool (e.g. language/runtime, or the
  file-watch strategy: polling vs OS filesystem events vs a watch library) via `AskUserQuestion`.
- Each option is viable **for the stated requirement** (a directory-watching uploader) with a concrete
  tradeoff — not generic "use any language" filler.
- If a tradeoff is conditional (e.g. polling fine for small trees, FS-events needed at scale), the reveal
  names the dimension + threshold and re-forks once if it's unknown.
- The reveal acknowledges there's no codebase yet and grounds in requirements + ecosystem norms.

## FAIL

- Claims it "read the codebase" when there is none, or refuses to fork for lack of code.
- Offers strawman options unrelated to a watch-and-upload tool.
- Asks *why* the user wants to upload to S3 / what the business goal is.
