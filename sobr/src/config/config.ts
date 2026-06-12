import { homedir } from "node:os";
import { join } from "node:path";

export type ProviderKind = "anthropic" | "openai";

export interface SobrConfig {
  model: string;
  maxTokens: number;
  /** "anthropic" (default) or "openai" — the latter covers any OpenAI-compatible API (GPT, DeepSeek, …). */
  provider: ProviderKind;
  /** Base URL for the openai provider, e.g. https://api.deepseek.com/v1. Ignored for anthropic. */
  baseUrl: string;
  /** Env var holding the API key. Empty = auto (ANTHROPIC_API_KEY / OPENAI_API_KEY by provider). */
  apiKeyEnv: string;
}

export const DEFAULT_CONFIG: SobrConfig = {
  model: "claude-sonnet-4-6",
  maxTokens: 8192,
  provider: "anthropic",
  baseUrl: "https://api.openai.com/v1",
  apiKeyEnv: "",
};

const KNOWN_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

/** Merge one config layer, failing loud on unknown keys (plan.md: no silent config drift). */
export function mergeConfigLayer(base: SobrConfig, layer: Record<string, unknown>, source: string): SobrConfig {
  const merged = { ...base };
  for (const [key, value] of Object.entries(layer)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`Unknown config key "${key}" in ${source}. Known keys: ${[...KNOWN_KEYS].join(", ")}`);
    }
    (merged as Record<string, unknown>)[key] = value;
  }
  if (merged.provider !== "anthropic" && merged.provider !== "openai") {
    throw new Error(`Invalid provider "${merged.provider}" in ${source}. Use "anthropic" or "openai".`);
  }
  return merged;
}

async function readLayer(path: string): Promise<Record<string, unknown> | null> {
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  try {
    return JSON.parse(await file.text());
  } catch (e) {
    throw new Error(`Invalid JSON in ${path}: ${(e as Error).message}`);
  }
}

/** Layers: defaults ← ~/.sobr/config.json ← <cwd>/.sobr.json */
export async function loadConfig(cwd: string, home = homedir()): Promise<SobrConfig> {
  let config = { ...DEFAULT_CONFIG };
  const globalPath = join(home, ".sobr", "config.json");
  const projectPath = join(cwd, ".sobr.json");
  const globalLayer = await readLayer(globalPath);
  if (globalLayer) config = mergeConfigLayer(config, globalLayer, globalPath);
  const projectLayer = await readLayer(projectPath);
  if (projectLayer) config = mergeConfigLayer(config, projectLayer, projectPath);
  return config;
}

/** Which env var to read the key from, and its current value. */
export function resolveApiKey(config: SobrConfig, env: Record<string, string | undefined> = process.env) {
  const name = config.apiKeyEnv || (config.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY");
  return { name, key: env[name] };
}
