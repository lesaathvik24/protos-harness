import type { Usage } from "../provider/types.ts";
import { contextWindowFor } from "../trace/cost.ts";

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Pure status line. The cache_read figure is the glass-box flex from plan.md:
 * it should go non-zero from iteration 2 of any multi-tool turn.
 *
 * `contextTokens` is the size of the CURRENT prompt (the last request's input +
 * cache) — pass it for an accurate ctx%. Omitted, it falls back to cumulative
 * usage (an overestimate, kept for callers that don't track per-turn size).
 */
export function renderStatus(model: string, usage: Usage, contextTokens?: number): string {
  const context = contextTokens ?? usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
  const pct = Math.min(100, Math.round((context / contextWindowFor(model)) * 100));
  const parts = [
    model,
    `in ${fmt(usage.inputTokens)}`,
    `out ${fmt(usage.outputTokens)}`,
    `cache_read ${fmt(usage.cacheReadTokens)}`,
    `ctx ~${pct}%`,
  ];
  return `\x1b[2m[${parts.join(" · ")}]\x1b[0m`;
}
