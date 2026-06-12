import { resolve } from "node:path";
import type { ToolDef } from "./types.ts";

const MAX_LINES = 2000;
const MAX_LINE_LEN = 2000;

export interface ReadInput {
  path: string;
  offset?: number;
  limit?: number;
}

export const readTool: ToolDef<ReadInput> = {
  name: "read",
  description:
    "Read a file from the filesystem. Returns content with line numbers (cat -n style). " +
    "Use offset/limit for large files.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file (absolute or relative to cwd)" },
      offset: { type: "number", description: "1-based line number to start from" },
      limit: { type: "number", description: "Max lines to return" },
    },
    required: ["path"],
  },
  mutates: false,
  async run(input, ctx) {
    const path = resolve(ctx.cwd, input.path);
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return { content: `File not found: ${path}`, isError: true };
    }
    const text = await file.text();
    const lines = text.split("\n");
    const start = Math.max(1, input.offset ?? 1);
    const limit = Math.min(input.limit ?? MAX_LINES, MAX_LINES);
    const slice = lines.slice(start - 1, start - 1 + limit);
    const numbered = slice
      .map((l, i) => {
        const clipped = l.length > MAX_LINE_LEN ? l.slice(0, MAX_LINE_LEN) + "…" : l;
        return `${String(start + i).padStart(6)}\t${clipped}`;
      })
      .join("\n");
    const more = lines.length > start - 1 + limit ? `\n… (${lines.length} lines total)` : "";
    return { content: numbered + more };
  },
};
