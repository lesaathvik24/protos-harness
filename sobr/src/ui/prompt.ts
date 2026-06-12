import * as readline from "node:readline/promises";
import type { PermAnswer, PermRequest, Prompter } from "../permission/gate.ts";
import type { TeachUi } from "../teach/fork-tool.ts";

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

/** Numbered fork picker + Hard-mode justification prompt over the shared readline. */
export function makeTerminalTeachUi(rl: readline.Interface): TeachUi {
  return {
    async askPick({ decision, options }) {
      console.log(`\n\x1b[35m⑂ FORK\x1b[0m ${decision}`);
      options.forEach((o, i) => console.log(`  ${i + 1}. ${o.label} — ${o.what}`));
      for (;;) {
        const raw = (await rl.question(`  pick [1-${options.length}] > `)).trim();
        const n = Number(raw);
        if (Number.isInteger(n) && n >= 1 && n <= options.length) return n - 1;
      }
    },
    async askText(prompt) {
      return rl.question(`  ${prompt}\n  > `);
    },
  };
}
