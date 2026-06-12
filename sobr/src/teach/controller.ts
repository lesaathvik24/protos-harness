import { TeachSession, type TeachLevel } from "./state.ts";
import { ProfileStore } from "./profile.ts";
import { makeForkTool, makeTrivialTool, type TeachUi, type TeachTraceFn } from "./fork-tool.ts";
import { teachPrompt } from "./prompt.ts";
import type { Agent } from "../loop/agent.ts";
import { ToolRegistry } from "../tools/registry.ts";

const LEVELS = new Set<string>(["L1", "L2", "L3"]);

export const TEACH_USAGE = "usage: /teach on L1|L2|L3 [hard] · /teach off · /teach profile";

/**
 * /teach control surface. Activation swaps the agent's registry (inject
 * fork+trivial) and system prompt (append the teach contract); deactivation
 * restores both. The gate itself never swaps — TeachWriteGate reads the shared
 * TeachSession, which is off by default.
 */
export class TeachController {
  private baseRegistry: ToolRegistry;
  private baseSystem: string;

  constructor(
    private agent: Agent,
    private profile: ProfileStore,
    private ui: TeachUi,
    public readonly session: TeachSession = new TeachSession(),
    private trace?: TeachTraceFn,
  ) {
    this.baseRegistry = agent.deps.dispatch.registry;
    this.baseSystem = agent.deps.system;
  }

  async handle(args: string): Promise<string> {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    const cmd = parts[0] ?? "";

    if (cmd === "on") {
      const level = (parts[1] ?? "L2").toUpperCase();
      const hard = (parts[2] ?? "").toLowerCase() === "hard";
      if (!LEVELS.has(level)) return `unknown level "${parts[1]}" — ${TEACH_USAGE}`;
      this.activate(level as TeachLevel, hard);
      return `teach mode active — ${level}${hard ? " hard" : ""} (fork/trivial injected; write gate armed)`;
    }
    if (cmd === "off") {
      this.deactivate();
      return "teach mode off (gate disarmed, tools removed)";
    }
    if (cmd === "profile") {
      return this.profile.render(await this.profile.load());
    }
    return TEACH_USAGE;
  }

  activate(level: TeachLevel, hard: boolean): void {
    this.session.activate(level, hard);
    const deps = { session: this.session, profile: this.profile, ui: this.ui, trace: this.trace };
    this.agent.deps.dispatch.registry = new ToolRegistry([
      ...this.baseRegistry.list(),
      makeForkTool(deps),
      makeTrivialTool(deps),
    ]);
    this.agent.deps.system = this.baseSystem + teachPrompt(level, hard);
  }

  deactivate(): void {
    this.session.deactivate();
    this.agent.deps.dispatch.registry = this.baseRegistry;
    this.agent.deps.system = this.baseSystem;
  }
}
