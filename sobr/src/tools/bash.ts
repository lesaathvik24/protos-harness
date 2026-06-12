import type { ToolDef } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT = 30_000;

export interface BashInput {
  command: string;
  timeout_ms?: number;
}

export const bashTool: ToolDef<BashInput> = {
  name: "bash",
  description:
    "Run a bash command in the working directory. Returns stdout+stderr. " +
    "Non-zero exit is reported as an error result with the output — inspect it and adapt.",
  inputSchema: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command to run" },
      timeout_ms: { type: "number", description: "Timeout in ms (default 120000)" },
    },
    required: ["command"],
  },
  mutates: true,
  async run(input, ctx) {
    const timeoutMs = Math.min(input.timeout_ms ?? DEFAULT_TIMEOUT_MS, 600_000);
    const proc = Bun.spawn(["bash", "-c", input.command], {
      cwd: ctx.cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill();
    }, timeoutMs);
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    clearTimeout(timer);

    let out = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n");
    if (out.length > MAX_OUTPUT) {
      out = out.slice(0, MAX_OUTPUT) + `\n… (output truncated at ${MAX_OUTPUT} chars)`;
    }
    if (timedOut) {
      return { content: `Command timed out after ${timeoutMs}ms\n${out}`, isError: true };
    }
    if (exitCode !== 0) {
      return { content: `${out}\n(exit code ${exitCode})`.trimStart(), isError: true };
    }
    return { content: out || "(no output)" };
  },
};
