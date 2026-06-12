import * as readline from "node:readline/promises";
import { Agent } from "./loop/agent.ts";
import { AnthropicProvider } from "./provider/anthropic.ts";
import { OpenAICompatProvider } from "./provider/openai.ts";
import type { Provider } from "./provider/types.ts";
import { defaultRegistry } from "./tools/registry.ts";
import { PermissionGate } from "./permission/gate.ts";
import { PolicyEngine } from "./policy/engine.ts";
import { TeachOffGate } from "./teach/gate.ts";
import { loadConfig, resolveApiKey, type SobrConfig } from "./config/config.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { render } from "./ui/render.ts";
import { renderStatus } from "./ui/status.ts";
import { makeTerminalPrompter } from "./ui/prompt.ts";

const HELP = `slash commands:
  /help   show this help
  /cost   show session token usage
  /exit   quit
(/teach, /compact, /cost-detail land in later weeks — see phases/)`;

export function makeProvider(config: SobrConfig): Provider {
  const { name, key } = resolveApiKey(config);
  if (!key) {
    console.error(`${name} is not set (provider "${config.provider}"). Set it, or point apiKeyEnv at another env var in .sobr.json.`);
    process.exit(1);
  }
  return config.provider === "openai"
    ? new OpenAICompatProvider({ apiKey: key, baseUrl: config.baseUrl })
    : new AnthropicProvider({ apiKey: key });
}

export async function buildAgent(cwd: string, rl: readline.Interface): Promise<Agent> {
  const config = await loadConfig(cwd);
  return new Agent({
    provider: makeProvider(config),
    config,
    system: SYSTEM_PROMPT,
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(),
      teachGate: new TeachOffGate(),
      permission: new PermissionGate(makeTerminalPrompter(rl)),
      ctx: { cwd },
      onWarn: (rule, message) => process.stdout.write(`\x1b[33m⚠ [${rule}] ${message}\x1b[0m\n`),
    },
    onUiEvent: (ev) => process.stdout.write(render(ev)),
  });
}

export async function runRepl(cwd: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const agent = await buildAgent(cwd, rl);
  const config = await loadConfig(cwd);
  console.log(`sobr — sober coding, no vibes. ${config.model} · ${cwd}\ntype /help for commands.\n`);

  for (;;) {
    const line = (await rl.question("sobr> ")).trim();
    if (!line) continue;
    if (line === "/exit" || line === "/quit") break;
    if (line === "/help") {
      console.log(HELP);
      continue;
    }
    if (line === "/cost") {
      console.log(renderStatus(config.model, agent.totalUsage));
      continue;
    }
    if (line.startsWith("/")) {
      console.log(`unknown command ${line} — /help`);
      continue;
    }
    try {
      await agent.runTurn(line);
      console.log(renderStatus(config.model, agent.totalUsage));
    } catch (e) {
      console.error(`\x1b[31merror: ${(e as Error).message}\x1b[0m`);
    }
  }
  rl.close();
}

export async function runOneShot(cwd: string, prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const agent = await buildAgent(cwd, rl);
  const config = await loadConfig(cwd);
  try {
    await agent.runTurn(prompt);
    console.log(renderStatus(config.model, agent.totalUsage));
  } finally {
    rl.close();
  }
}
