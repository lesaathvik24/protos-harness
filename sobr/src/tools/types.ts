// Core tool seam: every tool is a pure-ish unit with declared mutability.
// The dispatch pipeline (policy → teach-gate → permission → execute) keys off `mutates`.

export interface ToolContext {
  cwd: string;
}

export interface ToolOutput {
  content: string;
  isError?: boolean;
}

export interface ToolDef<I = Record<string, unknown>> {
  name: string;
  description: string;
  /** JSON Schema for the tool input (wire field: input_schema). */
  inputSchema: Record<string, unknown>;
  /** True for tools that change state (write/edit/bash) — these go through the permission gate. */
  mutates: boolean;
  run(input: I, ctx: ToolContext): Promise<ToolOutput>;
}

/** A tool_use block as assembled from the model stream. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}
