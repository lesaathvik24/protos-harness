import type { TraceEvent } from "./events.ts";
import { fmtUsd } from "./cost.ts";

/**
 * `sobr why <id>:<turn>` — explain a turn from its trace. Because api_request
 * carries the full messages array, this is a projection, not a reconstruction.
 */
export function whyTurn(events: TraceEvent[], turn: number): string {
  const turnEvents = events.filter((e) => e.turn === turn);
  if (turnEvents.length === 0) {
    const turns = [...new Set(events.map((e) => e.turn))].filter((t) => t > 0);
    return `No events for turn ${turn}. Turns in this session: ${turns.join(", ") || "(none)"}`;
  }

  let out = `## turn ${turn}\n`;
  for (const ev of turnEvents) {
    switch (ev.type) {
      case "user_input":
        out += `\nUSER: ${ev.text}\n`;
        break;
      case "api_request": {
        out += `\n--- api_request (iteration ${ev.iteration}) ---\n`;
        out += `model: ${ev.request.model} · tools: ${ev.request.toolNames.join(", ")}\n`;
        out += `system: ${ev.request.system.slice(0, 200)}${ev.request.system.length > 200 ? "…" : ""}\n`;
        out += `messages (${ev.request.messages.length}):\n`;
        out += JSON.stringify(ev.request.messages, null, 2) + "\n";
        break;
      }
      case "api_response":
        out += `\n--- api_response (iteration ${ev.iteration}) ---\n`;
        out += `stop: ${ev.stopReason} · in ${ev.usage.inputTokens} · out ${ev.usage.outputTokens} · cache_read ${ev.usage.cacheReadTokens} · cost ${fmtUsd(ev.costUsd)}\n`;
        out += JSON.stringify(ev.content, null, 2) + "\n";
        break;
      case "policy_verdict":
        if (ev.kind !== "allow") out += `\npolicy: ${ev.kind.toUpperCase()} [${ev.rule}] ${ev.message} (${ev.name}#${ev.id})\n`;
        break;
      case "teach_gate":
        if (!ev.allowed) out += `\nteach gate: BLOCKED ${ev.message} (${ev.name}#${ev.id})\n`;
        break;
      case "perm_decision":
        out += `permission: ${ev.behavior} (${ev.reason}) for ${ev.name}#${ev.id}\n`;
        break;
      case "tool_result":
        out += `tool_result ${ev.name}#${ev.id}: ${ev.isError ? "ERROR " : ""}${ev.digest} [sha256 ${ev.sha256.slice(0, 12)}…, ${ev.bytes}B]\n`;
        break;
      case "turn_end":
        out += `\nturn total: in ${ev.usage.inputTokens} · out ${ev.usage.outputTokens} · session cost ${fmtUsd(ev.costUsd)}\n`;
        break;
      default:
        break;
    }
  }
  return out;
}
