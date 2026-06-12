import type { ToolDef } from "./types.ts";

const MAX_RESULTS = 500;

export interface GlobInput {
  pattern: string;
}

export const globTool: ToolDef<GlobInput> = {
  name: "glob",
  description: 'Find files matching a glob pattern (e.g. "src/**/*.ts"). Returns matching paths relative to cwd.',
  inputSchema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Glob pattern" },
    },
    required: ["pattern"],
  },
  mutates: false,
  async run(input, ctx) {
    const glob = new Bun.Glob(input.pattern);
    const results: string[] = [];
    for await (const path of glob.scan({ cwd: ctx.cwd, onlyFiles: true, dot: false })) {
      if (path.startsWith("node_modules/") || path.includes("/node_modules/")) continue;
      results.push(path);
      if (results.length >= MAX_RESULTS) break;
    }
    results.sort();
    if (results.length === 0) return { content: "No files matched." };
    const more = results.length >= MAX_RESULTS ? `\n… (capped at ${MAX_RESULTS})` : "";
    return { content: results.join("\n") + more };
  },
};
