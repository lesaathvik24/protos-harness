import { resolve, dirname } from "node:path";
import { mkdir } from "node:fs/promises";
import type { ToolDef } from "./types.ts";

export interface WriteInput {
  path: string;
  content: string;
}

export const writeTool: ToolDef<WriteInput> = {
  name: "write",
  description: "Write content to a file, creating it (and parent directories) if needed. Overwrites existing content.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path to the file" },
      content: { type: "string", description: "Full file content to write" },
    },
    required: ["path", "content"],
  },
  mutates: true,
  async run(input, ctx) {
    const path = resolve(ctx.cwd, input.path);
    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, input.content);
    const lines = input.content.split("\n").length;
    return { content: `Wrote ${lines} lines to ${path}` };
  },
};
