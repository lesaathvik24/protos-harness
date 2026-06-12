import type { ToolDef } from "./types.ts";
import { readTool } from "./read.ts";
import { writeTool } from "./write.ts";
import { editTool } from "./edit.ts";
import { bashTool } from "./bash.ts";
import { globTool } from "./glob.ts";
import { grepTool } from "./grep.ts";

export class ToolRegistry {
  private tools = new Map<string, ToolDef<any>>();

  constructor(tools: ToolDef<any>[]) {
    for (const t of tools) this.tools.set(t.name, t);
  }

  get(name: string): ToolDef<any> | undefined {
    return this.tools.get(name);
  }

  list(): ToolDef<any>[] {
    return [...this.tools.values()];
  }

  /** Tool definitions in Anthropic wire format. */
  specs(): { name: string; description: string; input_schema: Record<string, unknown> }[] {
    return this.list().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
}

export function defaultRegistry(): ToolRegistry {
  return new ToolRegistry([readTool, globTool, grepTool, writeTool, editTool, bashTool]);
}
