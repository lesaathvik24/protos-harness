#!/usr/bin/env bun
import { runRepl, runOneShot, MissingApiKeyError } from "./repl.ts";
import { SessionStore } from "./session/store.ts";
import { renderReplay } from "./trace/replay.ts";
import { whyTurn } from "./trace/why.ts";
import { fmtUsd } from "./trace/cost.ts";

const USAGE = `sobr — the coding agent that refuses to let you vibecode

usage:
  sobr                 start the REPL in the current directory
  sobr -p "..."        one-shot prompt, then exit
  sobr sessions        list recorded sessions
  sobr replay <id>     re-render a session through the live renderer
  sobr why <id>:<turn> show the full model context + decisions for a turn
  sobr --help          this help

env: ANTHROPIC_API_KEY (or OPENAI_API_KEY / custom via apiKeyEnv — see README)`;

async function cmdSessions(): Promise<void> {
  const store = new SessionStore();
  const metas = await store.list();
  if (metas.length === 0) {
    console.log("No sessions recorded yet.");
    return;
  }
  for (const meta of metas) {
    const events = await store.trace(meta.id);
    const turns = events.filter((e) => e.type === "user_input").length;
    const last = [...events].reverse().find((e) => e.type === "turn_end");
    const cost = last && last.type === "turn_end" ? fmtUsd(last.costUsd) : "-";
    console.log(`${meta.id}  ${meta.startedAt}  ${meta.model}  turns:${turns}  cost:${cost}  ${meta.cwd}`);
  }
}

async function cmdReplay(idArg: string): Promise<void> {
  const store = new SessionStore();
  const id = await store.resolve(idArg);
  process.stdout.write(renderReplay(await store.trace(id)));
}

async function cmdWhy(arg: string): Promise<void> {
  const [idArg, turnArg] = arg.split(":");
  const turn = Number(turnArg);
  if (!idArg || !Number.isInteger(turn)) {
    console.error("usage: sobr why <session-id>:<turn>   e.g. sobr why 20260612-1:2");
    process.exit(1);
  }
  const store = new SessionStore();
  const id = await store.resolve(idArg);
  process.stdout.write(whyTurn(await store.trace(id), turn));
}

async function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return;
  }
  switch (args[0]) {
    case "sessions":
      await cmdSessions();
      return;
    case "replay":
      if (!args[1]) {
        console.error("usage: sobr replay <session-id>");
        process.exit(1);
      }
      await cmdReplay(args[1]);
      return;
    case "why":
      if (!args[1]) {
        console.error("usage: sobr why <session-id>:<turn>");
        process.exit(1);
      }
      await cmdWhy(args[1]);
      return;
  }
  const pIdx = args.indexOf("-p");
  if (pIdx !== -1) {
    const prompt = args[pIdx + 1];
    if (!prompt) {
      console.error('-p requires a prompt argument, e.g. sobr -p "fix the failing test"');
      process.exit(1);
    }
    await runOneShot(cwd, prompt);
    return;
  }
  if (args.length > 0) {
    console.error(`unknown arguments: ${args.join(" ")}\n\n${USAGE}`);
    process.exit(1);
  }
  await runRepl(cwd);
}

main().catch((e) => {
  // A missing API key is a user-config problem, not a crash — print it plainly.
  const prefix = e instanceof MissingApiKeyError ? "" : "fatal: ";
  console.error(`${prefix}${(e as Error).message}`);
  process.exit(1);
});
