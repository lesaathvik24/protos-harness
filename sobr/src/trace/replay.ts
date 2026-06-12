import type { TraceEvent } from "./events.ts";
import type { UiEvent } from "../loop/agent.ts";
import { render } from "../ui/render.ts";
import { renderStatus } from "../ui/status.ts";
import { fmtUsd } from "./cost.ts";

/**
 * Pure: trace events → UI events. Replay then pumps these through the SAME
 * render() the live session used — that's the honesty guarantee from plan.md.
 */
export function traceToUiEvents(events: TraceEvent[]): UiEvent[] {
  const out: UiEvent[] = [];
  for (const ev of events) {
    switch (ev.type) {
      case "api_response":
        for (const block of ev.content) {
          if (block.type === "text") out.push({ type: "text_delta", text: block.text });
        }
        out.push({ type: "assistant_done" });
        break;
      case "tool_call":
        out.push({ type: "tool_call", id: ev.id, name: ev.name, input: ev.input });
        break;
      case "tool_result":
        out.push({ type: "tool_result", id: ev.id, name: ev.name, content: ev.digest, isError: ev.isError });
        break;
      case "turn_end":
        out.push({ type: "turn_end", usage: ev.usage });
        break;
      default:
        break;
    }
  }
  return out;
}

/** Full replay text for a session (user prompts are REPL chrome, not render()). */
export function renderReplay(events: TraceEvent[]): string {
  let out = "";
  let model = "";
  for (const ev of events) {
    switch (ev.type) {
      case "session_start":
        model = ev.model;
        out += `# session ${ev.sessionId} · ${ev.model} · ${ev.cwd}\n\n`;
        break;
      case "user_input":
        out += `sobr> ${ev.text}\n`;
        break;
      case "policy_verdict":
        if (ev.kind === "warn") out += `⚠ [${ev.rule}] ${ev.message}\n`;
        if (ev.kind === "deny") out += `⛔ [${ev.rule}] ${ev.message}\n`;
        break;
      case "turn_end":
        out += render({ type: "turn_end", usage: ev.usage });
        out += renderStatus(model, ev.usage) + ` cost ${fmtUsd(ev.costUsd)}\n\n`;
        break;
      default:
        for (const ui of traceToUiEvents([ev])) out += render(ui);
        break;
    }
  }
  return out;
}
