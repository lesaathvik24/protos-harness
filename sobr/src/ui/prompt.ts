import * as readline from "node:readline/promises";
import type { PermAnswer, PermRequest, Prompter } from "../permission/gate.ts";

const VALID = new Set<PermAnswer>(["y", "a", "p", "n"]);

/** Interactive y/a/p/n permission prompt over a shared readline interface. */
export function makeTerminalPrompter(rl: readline.Interface): Prompter {
  return async (req: PermRequest): Promise<PermAnswer> => {
    const options = req.bashPrefix
      ? `y once · a always ${req.tool} · p always "${req.bashPrefix} …" · n deny`
      : `y once · a always ${req.tool} · n deny`;
    for (;;) {
      const raw = (await rl.question(`\x1b[33m${req.tool}?\x1b[0m ${req.summary}\n  [${options}] > `))
        .trim()
        .toLowerCase();
      if (VALID.has(raw as PermAnswer)) {
        if (raw === "p" && !req.bashPrefix) continue;
        return raw as PermAnswer;
      }
    }
  };
}
