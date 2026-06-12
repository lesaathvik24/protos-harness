# Phase 1 (Week 1) — Core runtime: loop, tools, provider, permissions

**Goal (from plan.md):** Scaffold, provider+caching, tools, dispatch, permissions, renderer/status.
**Demo:** "add a function + test" works on a real repo.
**Riskiest item:** streamed tool_use accumulation / multi-call turns → FakeAnthropic + SSE fixtures built THIS week.

Status legend: `[ ]` todo · `[x]` done. Every done task gets a "How" note so the next session can pick up cold.

## Tasks

- [ ] **1. Scaffold package** — `sobr/` dir: package.json (bun, `@anthropic-ai/sdk`), strict tsconfig, scripts (`typecheck`, `test`), directory layout per plan.md architecture.
  - How: _pending_
- [ ] **2. Core types + tool registry** — `ToolDef{name,description,inputSchema,mutates,run}`, `ToolResult`, registry that exposes tool list + lookup.
  - How: _pending_
- [ ] **3. File tools: read / write / edit** — edit must hard-fail on 0 matches and on >1 match unless `replaceAll`. Unit tests for those failure modes (plan.md testing section names them).
  - How: _pending_
- [ ] **4. Exec & search tools: bash / glob / grep** — bash via Bun.spawn with timeout; non-zero exit is a tool_result, never a loop error. Unit tests.
  - How: _pending_
- [ ] **5. Config loader** — `~/.sobr/config.json` + project `.sobr.json`, default model `claude-sonnet-4-6`, fail loud on unknown keys. Unit tests.
  - How: _pending_
- [ ] **6. Anthropic provider + assemble()** — streaming via SDK, maxRetries:4, cache_control breakpoints (last system block, last tool def, last message block). Normalized stream-event type; pure `assemble()` turns an event stream into a full message (text + tool_use blocks, split input_json_delta concat). Unit tests over split-JSON event sequences.
  - How: _pending_
- [ ] **7. SSE fixtures + FakeAnthropic** — recorded-format stream-event fixtures (text turn, single tool call, parallel tool calls, multi-iteration turn); FakeAnthropic implements the same Provider interface by replaying them.
  - How: _pending_
- [ ] **8. Permission gate** — read/glob/grep allow; write/edit/bash ask. Answers: y(once) / a(always this tool) / p(bash prefix) / n(deny). In-memory session grants only. Unit tests with injected prompter.
  - How: _pending_
- [ ] **9. Dispatch pipeline** — policy(stub-allow) → teach-gate(stub-pass) → permission → execute; deny/denied/tool-error all become tool_results (`is_error` where appropriate). Unit tests.
  - How: _pending_
- [ ] **10. Agent loop** — turn loop: stream assistant msg → if stop `tool_use`, dispatch all tool_use blocks → tool_results as ONE user message → continue until `end_turn`. Aborted stream discards partial message. Loop tests on FakeAnthropic: text turn, single tool call, parallel tool calls, deny-enters-history.
  - How: _pending_
- [ ] **11. Renderer + status line** — pure render fns (event → string; replay in week 2 depends on this purity), status line shows model, context %, and `cache_read` savings.
  - How: _pending_
- [ ] **12. CLI + REPL** — `sobr` bin → REPL (readline), one-shot `sobr -p "..."`; slash commands `/help` `/exit`; in-memory usage tally for status line.
  - How: _pending_
- [ ] **13. Week-1 wrap** — `bun run typecheck` clean, full `bun test` green, sobr/README stub with run instructions.
  - How: _pending_

## Manual checks before Phase 2 (need a human + API key)

1. **Live demo run:** on your laptop, `export ANTHROPIC_API_KEY=...`, `cd` a scratch repo, run `bun run /path/to/sobr/src/cli.ts`, ask *"add a function + test"* → verify a multi-tool turn edits real files and the result is sane.
2. **Permission UX:** during that run confirm y/a/p/n prompts feel right (a remembered for the tool, p remembered for the bash prefix).
3. **Record real SSE fixtures:** run `bun run sobr/scripts/record-sse.ts` (writes raw stream events for a tool-use turn) and drop them into `sobr/test/fixtures/sse/` — confirms the hand-built fixtures match real wire format.
4. **Cache check:** in a multi-tool turn, status line should show non-zero `cache_read` from iteration 2 onward.
