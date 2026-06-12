#!/usr/bin/env bun
import { runRepl, runOneShot } from "./repl.ts";

const USAGE = `sobr — the coding agent that refuses to let you vibecode

usage:
  sobr            start the REPL in the current directory
  sobr -p "..."   one-shot prompt, then exit
  sobr --help     this help

env: ANTHROPIC_API_KEY (required)`;

async function main() {
  const args = process.argv.slice(2);
  const cwd = process.cwd();

  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
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
  console.error(`fatal: ${(e as Error).message}`);
  process.exit(1);
});
