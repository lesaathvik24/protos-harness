import type { UiEvent } from "../loop/agent.ts";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

function digest(s: string, max = 200): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "…" : oneLine;
}

function inputSummary(input: Record<string, unknown>): string {
  if (typeof input.command === "string") return input.command;
  if (typeof input.path === "string") return input.path;
  if (typeof input.pattern === "string") return input.pattern;
  return digest(JSON.stringify(input), 120);
}

/**
 * Pure: UiEvent → string to print (no I/O here). Week-2 replay pumps recorded
 * events through this exact function, so keep it side-effect free.
 */
export function render(ev: UiEvent): string {
  switch (ev.type) {
    case "text_delta":
      return ev.text;
    case "assistant_done":
      return "\n";
    case "tool_call":
      return cyan(`⚒ ${ev.name}`) + dim(`(${digest(inputSummary(ev.input), 120)})`) + "\n";
    case "tool_result":
      return ev.isError ? red(`  ✗ ${digest(ev.content)}`) + "\n" : dim(`  → ${digest(ev.content)}`) + "\n";
    case "turn_end":
      return "";
  }
}
