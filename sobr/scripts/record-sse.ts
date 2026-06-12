#!/usr/bin/env bun
// Manual check #3 for phase 1: record REAL stream events from the live API and
// write them as a fixture, to confirm the hand-built fixtures match wire format.
//
//   ANTHROPIC_API_KEY=... bun run scripts/record-sse.ts [outfile]
//
// Sends a prompt that reliably triggers a tool_use turn against the week-1
// tool specs, and dumps every raw SSE event as JSON.

import Anthropic from "@anthropic-ai/sdk";
import { defaultRegistry } from "../src/tools/registry.ts";

const out = process.argv[2] ?? "test/fixtures/sse/recorded-tool-turn.json";
const client = new Anthropic({ maxRetries: 4 });

const stream = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  system: "You are a coding agent. Use the tools.",
  tools: defaultRegistry().specs() as any,
  messages: [
    {
      role: "user",
      content: "Read the file ./README.md and also glob for **/*.ts — do both before answering.",
    },
  ],
  stream: true,
});

const events: unknown[] = [];
for await (const ev of stream) {
  events.push(ev);
  console.log(ev.type);
}

await Bun.write(out, JSON.stringify(events, null, 2) + "\n");
console.log(`\nwrote ${events.length} events to ${out}`);
