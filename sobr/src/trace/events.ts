import type { ContentBlock, Msg, StopReason, Usage } from "../provider/types.ts";

// Glass-box trace: one JSONL line per event, per session.
// api_request carries the FULL messages array — deliberate redundancy that makes
// `why` trivially correct. Do not optimize this away in v1 (plan.md).

export interface TraceBase {
  ts: string;
  turn: number;
}

export type TraceEvent = TraceBase &
  (
    | { type: "session_start"; sessionId: string; cwd: string; model: string; provider: string }
    | { type: "user_input"; text: string }
    | {
        type: "api_request";
        iteration: number;
        request: { model: string; system: string; messages: Msg[]; toolNames: string[] };
      }
    | {
        type: "api_response";
        iteration: number;
        id: string;
        model: string;
        stopReason: StopReason;
        content: ContentBlock[];
        usage: Usage;
        costUsd: number | null;
      }
    | { type: "tool_call"; id: string; name: string; input: Record<string, unknown> }
    | {
        type: "tool_result";
        id: string;
        name: string;
        isError: boolean;
        digest: string;
        sha256: string;
        bytes: number;
      }
    | { type: "policy_verdict"; id: string; name: string; kind: "allow" | "warn" | "deny"; rule?: string; message?: string }
    | { type: "teach_gate"; id: string; name: string; allowed: boolean; message?: string }
    | { type: "perm_decision"; id: string; name: string; behavior: "allow" | "deny"; reason: string }
    | { type: "turn_end"; usage: Usage; costUsd: number }
    | { type: "turn_aborted"; iteration: number }
    // week 3
    | { type: "fork_surfaced"; payload: Record<string, unknown> }
    | { type: "fork_rejected"; payload: Record<string, unknown> }
    | { type: "fork_resolved"; payload: Record<string, unknown> }
    | { type: "trivial_logged"; payload: Record<string, unknown> }
    // week 4
    | { type: "compaction"; payload: Record<string, unknown> }
  );

export interface TraceEmitter {
  emit(ev: TraceEvent): void;
}

export function digestOf(content: string, max = 200): string {
  const oneLine = content.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max) + "…" : oneLine;
}

export function sha256Of(content: string): string {
  return new Bun.CryptoHasher("sha256").update(content).digest("hex");
}
