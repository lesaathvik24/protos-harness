import type { TraceEvent } from "./events.ts";
import type { Msg } from "../provider/types.ts";

/**
 * Rebuild an agent's message history from a session trace.
 *
 * The last `api_request` event carries the FULL messages array (with complete
 * tool_result bodies — the same redundancy that makes `why` correct), so the
 * history at that point is recoverable losslessly. If the final `api_response`
 * was a terminal answer (not a tool_use), we append it so the resumed session
 * remembers its last reply. A trailing tool_use response is dropped — its tool
 * results were never sent back, so the clean resume point is the last request.
 */
export function historyFromTrace(events: TraceEvent[]): Msg[] {
  let lastReq: Extract<TraceEvent, { type: "api_request" }> | undefined;
  let lastResp: Extract<TraceEvent, { type: "api_response" }> | undefined;
  for (const ev of events) {
    if (ev.type === "api_request") lastReq = ev;
    else if (ev.type === "api_response") lastResp = ev;
  }
  if (!lastReq) return [];

  const history: Msg[] = structuredClone(lastReq.request.messages);
  if (
    lastResp &&
    lastResp.turn === lastReq.turn &&
    lastResp.iteration === lastReq.iteration &&
    lastResp.stopReason !== "tool_use"
  ) {
    history.push({ role: "assistant", content: lastResp.content });
  }
  return history;
}

/** True if the trace has anything resumable (at least one request). */
export function isResumable(events: TraceEvent[]): boolean {
  return events.some((e) => e.type === "api_request");
}
