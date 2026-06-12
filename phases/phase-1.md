# Phase 1 (Week 1) — Core runtime: loop, tools, provider, permissions

**Goal (from plan.md):** Scaffold, provider+caching, tools, dispatch, permissions, renderer/status.
**Demo:** "add a function + test" works on a real repo.
**Riskiest item:** streamed tool_use accumulation / multi-call turns → FakeAnthropic + SSE fixtures built THIS week. ✅ done — see tasks 6–7.

**Status: code complete (2026-06-12). All automated checks green: `tsc --noEmit` clean, `bun test` 58/58.**
**Remaining: the 4 manual checks at the bottom (need a human + ANTHROPIC_API_KEY).**

Status legend: `[ ]` todo · `[x]` done. Every done task has a "How" note so the next session can pick up cold.

## Tasks

- [x] **1. Scaffold package** — `sobr/` dir at repo root.
  - How: `sobr/package.json` (bun, `@anthropic-ai/sdk@^0.104.1`, `@types/bun`, typescript), strict `tsconfig.json` (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, bundler resolution, `types:["bun"]`). Scripts: `bun run typecheck`, `bun test`, `bun run start`. `node_modules/` added to repo-root `.gitignore`; `bun.lock` IS committed.
- [x] **2. Core types + tool registry**
  - How: `src/tools/types.ts` — `ToolDef<I>{name,description,inputSchema,mutates,run}`, `ToolOutput{content,isError}`, `ToolCall`. `src/tools/registry.ts` — `ToolRegistry` with `get/list/specs()`; `specs()` emits Anthropic wire format (`input_schema`). `defaultRegistry()` = read, glob, grep, write, edit, bash.
- [x] **3. File tools: read / write / edit**
  - How: `read.ts` (cat -n numbering, offset/limit, 2000-line/2000-char caps), `write.ts` (mkdir -p parents), `edit.ts` (exact-string replace; **errors on 0 matches and on >1 match unless `replace_all`**, also on old==new; error text tells the model how to recover). Tests: `test/unit/edit.test.ts` (6), part of `tools.test.ts`.
- [x] **4. Exec & search tools: bash / glob / grep**
  - How: `bash.ts` — `Bun.spawn(["bash","-c",…])` in ctx.cwd, manual setTimeout kill (default 120 s), output capped at 30 k chars; **non-zero exit and timeouts return `isError` tool_results, never throw**. `glob.ts` — `Bun.Glob.scan`, skips node_modules, 500-result cap. `grep.ts` — regex over Bun.Glob walk, `file:line:text` output, NUL-byte binary skip, 200-match cap. Tests in `test/unit/tools.test.ts`.
- [x] **5. Config loader**
  - How: `src/config/config.ts` — defaults `{model:"claude-sonnet-4-6", maxTokens:8192}` ← `~/.sobr/config.json` ← `<cwd>/.sobr.json`. `mergeConfigLayer` is pure and **throws on unknown keys naming the offending file**; invalid JSON also fails loud. `loadConfig(cwd, home?)` — home injectable for tests. Tests: `test/unit/config.test.ts` (5).
- [x] **6. Anthropic provider + assemble()**
  - How: `src/provider/types.ts` — Provider seam: `Provider.stream(ProviderRequest{model,system,messages,tools,maxTokens}) → AsyncIterable<StreamEvent>`; `StreamEvent` is a structural subset of the real SSE wire events. `src/provider/assemble.ts` — **the shared accumulation path** (split `input_json_delta` concat → JSON.parse at `content_block_stop`; index-keyed partial blocks; usage from message_start + message_delta; throws on aborted/unterminated streams). `src/provider/anthropic.ts` — SDK with `maxRetries:4`, `stream:true`; cache breakpoints (`cache_control:{type:"ephemeral"}`) on **last tool def + last system block + last message content block** (3 of the 4 allowed). Tests: `test/unit/assemble.test.ts` (7) incl. split-JSON and malformed-JSON cases.
- [x] **7. SSE fixtures + FakeAnthropic**
  - How: `test/fixtures/sse/*.json` — text-turn, single-tool (input JSON split across 3 deltas), parallel-tools (2 tool_use blocks), final-answer, write-attempt. `test/helpers/fake.ts` — `FakeAnthropic implements Provider`, replays one script per call, **records every ProviderRequest** for assertions; `loadFixture(name)`. `scripts/record-sse.ts` records REAL events (manual check 3).
- [x] **8. Permission gate**
  - How: `src/permission/gate.ts` — `mutates:false` → allow without prompting; mutating tools prompt via injected `Prompter` (pure seam → fully testable). `y` once / `a` session tool-grant (Set) / `p` session bash-prefix grant (first two tokens via `bashPrefixOf`; prefix match is token-safe: `cmd === p || cmd.startsWith(p+" ")`) / `n` deny with model-actionable message. Session-memory only. Tests: `test/unit/permission.test.ts` (9).
- [x] **9. Dispatch pipeline**
  - How: `src/loop/dispatch.ts` — `dispatchToolCall(call, deps)`: unknown-tool → policy (deny → `POLICY DENIED [rule]`, warn → `onWarn` hook + proceed) → teach gate (week-1 stub `TeachOffGate` always passes; real gate lands week 3 behind the same `TeachGate` interface in `src/teach/gate.ts`) → permission → execute with try/catch. **Every failure path returns an `is_error` tool_result; the loop never sees a throw.** `src/policy/engine.ts` has the final `Verdict{allow|warn|deny}` + `PolicyRule` shapes so week 2 only adds rules. Tests: `test/unit/dispatch.test.ts` (7).
- [x] **10. Agent loop**
  - How: `src/loop/agent.ts` — `Agent.runTurn(input)`: push user msg → stream+assemble → push assistant blocks → if `stop_reason==="tool_use"` dispatch each tool_use **sequentially in block order** and push all results as **one** user message → loop (cap 50 iterations). Abort signal discards the partial assistant message (history stays consistent). Emits `UiEvent`s (text_delta / tool_call / tool_result / turn_end) — the renderer seam. Tests: `test/loop/agent.test.ts` (6) on FakeAnthropic: text turn, single tool (result content + history shape + usage tally), parallel calls in one user message in order, **deny-enters-history as is_error**, request carries system/tools/model, UI event ordering.
- [x] **11. Renderer + status line**
  - How: `src/ui/render.ts` — **pure** `render(UiEvent) → string` (ANSI; digest() for one-line tool summaries). Week-2 replay will pump trace events through this same function — keep it side-effect free. `src/ui/status.ts` — `renderStatus(model, usage)` shows in/out/`cache_read`/ctx% (200k window assumed for now). Tests: `test/unit/render.test.ts` (5).
- [x] **12. CLI + REPL**
  - How: `src/cli.ts` — `--help`, `-p "…"` one-shot, no-args → REPL; clear errors otherwise. `src/repl.ts` — readline REPL, slash `/help` `/cost` `/exit`; `buildAgent()` wires provider+registry+gates+renderer; status line after every turn. `src/ui/prompt.ts` — y/a/p/n terminal prompter over the shared readline (re-asks on invalid input, hides `p` for non-bash). API key from `ANTHROPIC_API_KEY` only.
- [x] **13. Week-1 wrap**
  - How: `bun run typecheck` clean; `bun test` → **58 pass / 0 fail across 8 files**; `sobr/README.md` with run/config/dev instructions. CLI smoke-tested (`--help`, bad-args exit 1).

## Notes for the next session

- The teach/policy seams are deliberately final-shaped: week 2 = add `PolicyRule`s + trace emission, week 3 = swap `TeachOffGate` for the real pendingTag gate. Dispatch and loop should not need changes.
- `assemble()`'s `onEvent` hook is where week-2 trace `api_request`/`api_response` emission will attach; `DispatchDeps.onWarn` is the `policy_verdict` hook.
- npm name: `sobr` is taken → publish as `sobr-cli` or scoped (decided at week-4 kickoff; noted in plan.md and phase-4.md).

## Manual checks before Phase 2 (need a human + API key)

1. **Live demo run:** on your laptop, `export ANTHROPIC_API_KEY=...`, `cd` a scratch repo, run `bun run /path/to/sobr/src/cli.ts`, ask *"add a function + test"* → verify a multi-tool turn edits real files and the result is sane.
2. **Permission UX:** during that run confirm y/a/p/n prompts feel right (a remembered for the tool, p remembered for the bash prefix).
3. **Record real SSE fixtures:** `cd sobr && bun run scripts/record-sse.ts` → writes `test/fixtures/sse/recorded-tool-turn.json`; diff the event shapes against the hand-built fixtures (they should be a superset — extra `ping`/usage fields are fine and are ignored by the provider).
4. **Cache check:** in a multi-tool turn, the status line should show non-zero `cache_read` from iteration 2 onward. NOTE: prompts under ~2–4k tokens silently don't cache on some models — if cache_read stays 0 on a tiny scratch repo, that's expected; retry in a repo where the system+tools+history prefix is bigger.
