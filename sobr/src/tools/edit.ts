import { resolve } from "node:path";
import type { ToolDef } from "./types.ts";

export interface EditInput {
  path: string;
  old_string: string;
  new_string: string;
  replace_all?: boolean;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle === "") return 0;
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++;
    idx += needle.length;
  }
  return count;
}

export const editTool: ToolDef<EditInput> = {
  name: "edit",
  description:
    "Replace an exact string in a file. old_string must match exactly once unless replace_all is true. " +
    "Fails (with guidance) on zero matches or ambiguous multiple matches.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      old_string: { type: "string", description: "Exact text to replace (must be unique unless replace_all)" },
      new_string: { type: "string", description: "Replacement text" },
      replace_all: { type: "boolean", description: "Replace every occurrence (default false)" },
    },
    required: ["path", "old_string", "new_string"],
  },
  mutates: true,
  async run(input, ctx) {
    const path = resolve(ctx.cwd, input.path);
    const file = Bun.file(path);
    if (!(await file.exists())) {
      return { content: `File not found: ${path}`, isError: true };
    }
    if (input.old_string === input.new_string) {
      return { content: "old_string and new_string are identical — nothing to do.", isError: true };
    }
    const text = await file.text();
    const n = countOccurrences(text, input.old_string);
    if (n === 0) {
      return {
        content: `No match for old_string in ${path}. Read the file and retry with the exact text (including whitespace).`,
        isError: true,
      };
    }
    if (n > 1 && !input.replace_all) {
      return {
        content: `old_string matches ${n} times in ${path}. Make it unique by adding surrounding context, or pass replace_all: true.`,
        isError: true,
      };
    }
    const updated = input.replace_all
      ? text.split(input.old_string).join(input.new_string)
      : text.replace(input.old_string, input.new_string);
    await Bun.write(path, updated);
    return { content: `Replaced ${input.replace_all ? n : 1} occurrence(s) in ${path}` };
  },
};
