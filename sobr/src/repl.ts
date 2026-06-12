import * as readline from "node:readline/promises";
import { Agent } from "./loop/agent.ts";
import { AnthropicProvider } from "./provider/anthropic.ts";
import { OpenAICompatProvider } from "./provider/openai.ts";
import type { Provider } from "./provider/types.ts";
import { defaultRegistry } from "./tools/registry.ts";
import { PermissionGate } from "./permission/gate.ts";
import { PolicyEngine } from "./policy/engine.ts";
import { defaultRules, gitStatusAdvisory } from "./policy/rules/index.ts";
import { TeachWriteGate } from "./teach/gate.ts";
import { TeachController } from "./teach/controller.ts";
import { ProfileStore } from "./teach/profile.ts";
import { TeachSession } from "./teach/state.ts";
import { loadConfig, resolveApiKey, type SobrConfig } from "./config/config.ts";
import { SYSTEM_PROMPT } from "./prompt.ts";
import { render } from "./ui/render.ts";
import { renderStatus } from "./ui/status.ts";
import { makeTerminalPrompter, makeTerminalTeachUi } from "./ui/prompt.ts";
import { SessionStore, newSessionId } from "./session/store.ts";
import { TraceWriter } from "./trace/writer.ts";
import { fmtUsd } from "./trace/cost.ts";

const HELP = `slash commands:
  /help                       show this help
  /cost                       show session token usage + cost
  /teach on L1|L2|L3 [hard]   anti-vibecoding coach: fork at every real decision
  /teach off                  back to plain agent
  /teach profile              show the learner model
  /exit                       quit
(/compact lands in week 4 — see phases/)`;

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

export interface Session {
  agent: Agent;
  config: SobrConfig;
  sessionId: string;
  writer: TraceWriter;
  teach: TeachController;
}

export async function buildSession(cwd: string, rl: readline.Interface): Promise<Session> {
  const config = await loadConfig(cwd);
  const store = new SessionStore();
  const sessionId = newSessionId();
  const dir = await store.create({
    id: sessionId,
    startedAt: new Date().toISOString(),
    cwd,
    model: config.model,
    provider: config.provider,
  });
  const writer = new TraceWriter(dir);
  writer.emit({
    type: "session_start",
    ts: new Date().toISOString(),
    turn: 0,
    sessionId,
    cwd,
    model: config.model,
    provider: config.provider,
  });

  // One shared TeachSession: the gate reads it (off by default), /teach arms it.
  const teachSession = new TeachSession();
  const agent = new Agent({
    provider: makeProvider(config),
    config,
    system: SYSTEM_PROMPT,
    trace: writer,
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(defaultRules()),
      teachGate: new TeachWriteGate(teachSession),
      permission: new PermissionGate(makeTerminalPrompter(rl)),
      ctx: { cwd },
      onWarn: (rule, message) => process.stdout.write(`\x1b[33m⚠ [${rule}] ${message}\x1b[0m\n`),
    },
    onUiEvent: (ev) => process.stdout.write(render(ev)),
  });
  const teach = new TeachController(agent, new ProfileStore(), makeTerminalTeachUi(rl), teachSession, (ev) =>
    writer.emit({ ...ev, ts: new Date().toISOString(), turn: agent.turnNumber }),
  );
  return { agent, config, sessionId, writer, teach };
}

function costLine(session: Session): string {
  const { agent, config } = session;
  const cost = agent.costKnown ? fmtUsd(agent.totalCostUsd) : `≥${fmtUsd(agent.totalCostUsd)} (some models unpriced)`;
  return `${renderStatus(config.model, agent.totalUsage)} cost ${cost}`;
}

export async function runRepl(cwd: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const session = await buildSession(cwd, rl);
  console.log(`sobr — sober coding, no vibes. ${session.config.model} · ${cwd}`);
  console.log(`session ${session.sessionId} (sobr replay ${session.sessionId} later) · /help for commands\n`);
  for (const warning of gitStatusAdvisory(cwd)) console.log(`\x1b[33m${warning}\x1b[0m`);

  for (;;) {
    const line = (await rl.question("sobr> ")).trim();
    if (!line) continue;
    if (line === "/exit" || line === "/quit") break;
    if (line === "/help") {
      console.log(HELP);
      continue;
    }
    if (line === "/cost") {
      console.log(costLine(session));
      continue;
    }
    if (line === "/teach" || line.startsWith("/teach ")) {
      console.log(await session.teach.handle(line.slice("/teach".length)));
      continue;
    }
    if (line.startsWith("/")) {
      console.log(`unknown command ${line} — /help`);
      continue;
    }
    try {
      await session.agent.runTurn(line);
      console.log(costLine(session));
    } catch (e) {
      console.error(`\x1b[31merror: ${(e as Error).message}\x1b[0m`);
    }
  }
  await session.writer.flush();
  rl.close();
}

export async function runOneShot(cwd: string, prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const session = await buildSession(cwd, rl);
  try {
    await session.agent.runTurn(prompt);
    console.log(costLine(session));
  } finally {
    await session.writer.flush();
    rl.close();
  }
}
