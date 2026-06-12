# sobr

**The coding agent that refuses to let you vibecode.** A teaching-first, glass-box agent runtime over the Claude API — own loop, typed tools, policy engine, and (week 3) a teach mode that makes you pick at every real decision fork.

> Status: **week 1 of 4** — core runtime (loop, tools, provider+caching, permissions). See `../plan.md` for the full v1 spec and `../phases/` for live progress tracking.

## Run it

```sh
cd sobr && bun install
export ANTHROPIC_API_KEY=sk-ant-...

bun run src/cli.ts                    # REPL in the current directory
bun run src/cli.ts -p "add a test"    # one-shot
```

Slash commands in the REPL: `/help`, `/cost`, `/exit`.

Mutating tools (write/edit/bash) prompt before running: `y` once · `a` always this tool · `p` always this bash prefix · `n` deny. Grants last for the session only.

## Configure

`~/.sobr/config.json` (global) then `<repo>/.sobr.json` (project) — JSON only, unknown keys fail loud:

```json
{ "model": "claude-sonnet-4-6", "maxTokens": 8192 }
```

### Other providers (GPT, DeepSeek, anything OpenAI-compatible)

Set `provider: "openai"` plus the base URL and key env var:

```json
{ "provider": "openai", "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1", "apiKeyEnv": "DEEPSEEK_API_KEY" }
```

```json
{ "provider": "openai", "model": "gpt-4o" }
```

(`baseUrl` defaults to api.openai.com; `apiKeyEnv` defaults to `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` by provider.) Anthropic prompt-cache breakpoints don't apply on these providers — their automatic caching is mapped onto the same `cache_read` status figure.

## Develop

```sh
bun run typecheck   # tsc --noEmit
bun test            # 58 tests; loop tests run on FakeAnthropic + SSE fixtures
bun run scripts/record-sse.ts   # record real stream events as fixtures (needs API key)
```

Architecture (see plan.md for the full map): `loop/` turn loop + dispatch pipeline (policy → teach-gate → permission → execute) · `provider/` streaming + assemble + cache breakpoints · `tools/` read/write/edit/bash/glob/grep · `permission/` y/a/p/n gate · `ui/` pure renderer + status line.
