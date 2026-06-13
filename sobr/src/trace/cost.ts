import type { Usage } from "../provider/types.ts";

// USD per million tokens: [input, output]. Cache read ≈ 0.1× input,
// cache write ≈ 1.25× input (5-minute TTL pricing).
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-4-6": [3, 15],
  "claude-sonnet-4-5": [3, 15],
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-opus-4-6": [5, 25],
  "claude-haiku-4-5": [1, 5],
  "claude-fable-5": [10, 50],
};

/** null = unknown model (e.g. an openai-provider model) — shown as "n/a", never guessed. */
export function costUsd(model: string, usage: Usage): number | null {
  const price = PRICES[model];
  if (!price) return null;
  const [inPrice, outPrice] = price;
  const usd =
    (usage.inputTokens * inPrice +
      usage.outputTokens * outPrice +
      usage.cacheReadTokens * inPrice * 0.1 +
      usage.cacheWriteTokens * inPrice * 1.25) /
    1_000_000;
  return usd;
}

export function fmtUsd(usd: number | null): string {
  if (usd === null) return "n/a";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

// Context-window sizes (input tokens) for compaction warnings + status %.
const CONTEXT_WINDOWS: Record<string, number> = {
  "claude-sonnet-4-6": 1_000_000,
  "claude-sonnet-4-5": 1_000_000,
  "claude-opus-4-8": 1_000_000,
  "claude-opus-4-7": 1_000_000,
  "claude-opus-4-6": 1_000_000,
  "claude-fable-5": 1_000_000,
  "claude-haiku-4-5": 200_000,
};

/** Best-effort context window; unknown models (incl. openai-provider) fall back to 200K. */
export function contextWindowFor(model: string): number {
  return CONTEXT_WINDOWS[model] ?? 200_000;
}
