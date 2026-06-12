import { homedir } from "node:os";
import { join } from "node:path";

export interface SobrConfig {
  model: string;
  maxTokens: number;
}

export const DEFAULT_CONFIG: SobrConfig = {
  model: "claude-sonnet-4-6",
  maxTokens: 8192,
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
