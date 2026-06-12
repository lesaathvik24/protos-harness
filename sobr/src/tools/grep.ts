import { resolve } from "node:path";
import type { ToolDef } from "./types.ts";

const MAX_MATCHES = 200;
const MAX_FILE_BYTES = 1_000_000;

export interface GrepInput {
  pattern: string;
  path?: string;
  glob?: string;
}

export const grepTool: ToolDef<GrepInput> = {
  name: "grep",
  description:
    "Search file contents with a regex. Returns file:line:text matches. " +
    "Optional path (directory to search) and glob filter (e.g. \"*.ts\").",
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Regular expression to search for" },
      path: { type: "string", description: "Directory to search (default cwd)" },
      glob: { type: "string", description: "Glob filter for file names" },
    },
    required: ["pattern"],
  },
  mutates: false,
  async run(input, ctx) {
    let re: RegExp;
    try {
      re = new RegExp(input.pattern);
    } catch (e) {
      return { content: `Invalid regex: ${(e as Error).message}`, isError: true };
    }
    const root = resolve(ctx.cwd, input.path ?? ".");
    const glob = new Bun.Glob(input.glob ? `**/${input.glob}` : "**/*");
    const matches: string[] = [];
    outer: for await (const rel of glob.scan({ cwd: root, onlyFiles: true, dot: false })) {
      if (rel.startsWith("node_modules/") || rel.includes("/node_modules/")) continue;
      const file = Bun.file(resolve(root, rel));
      if (file.size > MAX_FILE_BYTES) continue;
      let text: string;
      try {
        text = await file.text();
      } catch {
        continue; // unreadable/binary
      }
      if (text.includes("\u0000")) continue; // binary
      const lines = text.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i]!)) {
          matches.push(`${rel}:${i + 1}:${lines[i]!.slice(0, 300)}`);
          if (matches.length >= MAX_MATCHES) break outer;
        }
      }
    }
    if (matches.length === 0) return { content: "No matches." };
    const more = matches.length >= MAX_MATCHES ? `\n… (capped at ${MAX_MATCHES})` : "";
    return { content: matches.join("\n") + more };
  },
};
