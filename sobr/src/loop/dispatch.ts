import type { ToolRegistry } from "../tools/registry.ts";
import type { ToolCall, ToolContext } from "../tools/types.ts";
import type { ContentBlock } from "../provider/types.ts";
import type { PolicyEngine } from "../policy/engine.ts";
import type { TeachGate } from "../teach/gate.ts";
import type { PermissionGate } from "../permission/gate.ts";

export interface DispatchDeps {
  registry: ToolRegistry;
  policy: PolicyEngine;
  teachGate: TeachGate;
  permission: PermissionGate;
  ctx: ToolContext;
  /** Hook for warn verdicts and (week 2) trace events. */
  onWarn?: (rule: string, message: string) => void;
}

export type ToolResultBlock = Extract<ContentBlock, { type: "tool_result" }>;

/**
 * Pipeline: policy → teach-gate → permission → execute.
 * Every failure mode becomes a tool_result the model can see and recover from —
 * never a loop error (plan.md loop essentials).
 */
export async function dispatchToolCall(call: ToolCall, deps: DispatchDeps): Promise<ToolResultBlock> {
  const fail = (content: string): ToolResultBlock => ({
    type: "tool_result",
    tool_use_id: call.id,
    content,
    is_error: true,
  });

  const tool = deps.registry.get(call.name);
  if (!tool) return fail(`Unknown tool: ${call.name}`);

  const verdict = deps.policy.check(call);
  if (verdict.kind === "deny") return fail(`POLICY DENIED [${verdict.rule}]: ${verdict.message}`);
  if (verdict.kind === "warn") deps.onWarn?.(verdict.rule, verdict.message);

  const gate = deps.teachGate.check(call);
  if (!gate.allowed) return fail(gate.message);

  const perm = await deps.permission.check(tool, call.input);
  if (perm.behavior === "deny") return fail(perm.message);

  try {
    const out = await tool.run(call.input, deps.ctx);
    return { type: "tool_result", tool_use_id: call.id, content: out.content, is_error: out.isError || undefined };
  } catch (e) {
    return fail(`Tool ${call.name} threw: ${(e as Error).message}`);
  }
}
