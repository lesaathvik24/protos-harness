import type { Usage } from "../provider/types.ts";

const CONTEXT_WINDOW = 200_000;

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Pure status line. The cache_read figure is the glass-box flex from plan.md:
 * it should go non-zero from iteration 2 of any multi-tool turn.
 */
export function renderStatus(model: string, usage: Usage): string {
  const context = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const pct = Math.min(100, Math.round((context / CONTEXT_WINDOW) * 100));
  const parts = [
    model,
    `in ${fmt(usage.inputTokens)}`,
    `out ${fmt(usage.outputTokens)}`,
    `cache_read ${fmt(usage.cacheReadTokens)}`,
    `ctx ~${pct}%`,
  ];
  return `\x1b[2m[${parts.join(" · ")}]\x1b[0m`;
}
