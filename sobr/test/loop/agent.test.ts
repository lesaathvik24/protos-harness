import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type UiEvent } from "../../src/loop/agent.ts";
import { defaultRegistry } from "../../src/tools/registry.ts";
import { PolicyEngine } from "../../src/policy/engine.ts";
import { TeachOffGate } from "../../src/teach/gate.ts";
import { PermissionGate, type PermAnswer } from "../../src/permission/gate.ts";
import { DEFAULT_CONFIG } from "../../src/config/config.ts";
import { FakeAnthropic, loadFixture } from "../helpers/fake.ts";
import type { StreamEvent } from "../../src/provider/types.ts";

async function makeAgent(scripts: StreamEvent[][], answers: PermAnswer[] = []) {
  const cwd = await mkdtemp(join(tmpdir(), "sobr-agent-"));
  const provider = new FakeAnthropic(scripts);
  const events: UiEvent[] = [];
  let i = 0;
  const agent = new Agent({
    provider,
    config: DEFAULT_CONFIG,
    system: "test system",
    dispatch: {
      registry: defaultRegistry(),
      policy: new PolicyEngine(),
      teachGate: new TeachOffGate(),
      permission: new PermissionGate(async () => answers[i++] ?? "n"),
      ctx: { cwd },
    },
    onUiEvent: (ev) => events.push(ev),
  });
  return { agent, provider, cwd, events };
}

describe("agent loop on FakeAnthropic", () => {
  test("text-only turn: one request, history user+assistant", async () => {
    const { agent, provider, events } = await makeAgent([await loadFixture("text-turn")]);
    await agent.runTurn("hi");
    expect(provider.requests).toHaveLength(1);
    expect(agent.history).toHaveLength(2);
    expect(agent.history[1]!.role).toBe("assistant");
    const text = events.filter((e) => e.type === "text_delta").map((e) => (e as any).text).join("");
    expect(text).toBe("Hello! I can help with that.");
  });

  test("single tool call: executes read, sends result, continues to end_turn", async () => {
    const { agent, provider, cwd } = await makeAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "hi from file");
    await agent.runTurn("read hello.txt");

    expect(provider.requests).toHaveLength(2);
    // second request carries full history: user, assistant(tool_use), user(tool_result)
    const second = provider.requests[1]!;
    expect(second.messages).toHaveLength(3);
    const toolResultMsg = second.messages[2]!;
    expect(toolResultMsg.role).toBe("user");
    expect(toolResultMsg.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "toolu_read_1" });
    expect((toolResultMsg.content[0] as any).content).toContain("hi from file");
    // final history: + assistant end_turn
    expect(agent.history).toHaveLength(4);
    expect(agent.totalUsage.outputTokens).toBe(45 + 20);
    expect(agent.totalUsage.cacheReadTokens).toBe(500);
  });

  test("parallel tool calls: all results in ONE user message, in call order", async () => {
    const { agent, provider } = await makeAgent([
      await loadFixture("parallel-tools"),
      await loadFixture("final-answer"),
    ]);
    await agent.runTurn("scan the repo");
    const second = provider.requests[1]!;
    const resultMsg = second.messages[2]!;
    expect(resultMsg.role).toBe("user");
    expect(resultMsg.content).toHaveLength(2);
    expect(resultMsg.content.map((b: any) => b.tool_use_id)).toEqual(["toolu_glob_1", "toolu_grep_1"]);
  });

  test("permission deny enters history as is_error and the model sees it", async () => {
    const { agent, provider } = await makeAgent(
      [await loadFixture("write-attempt"), await loadFixture("final-answer")],
      ["n"],
    );
    await agent.runTurn("write out.txt");
    const second = provider.requests[1]!;
    const result = second.messages[2]!.content[0] as any;
    expect(result.type).toBe("tool_result");
    expect(result.is_error).toBe(true);
    expect(result.content).toContain("denied");
  });

  test("requests carry system, tools and model from config", async () => {
    const { agent, provider } = await makeAgent([await loadFixture("text-turn")]);
    await agent.runTurn("hi");
    const req = provider.requests[0]!;
    expect(req.system).toBe("test system");
    expect(req.model).toBe(DEFAULT_CONFIG.model);
    expect(req.tools.map((t) => t.name)).toContain("edit");
  });

  test("ui event order: tool_call before its tool_result, turn_end last", async () => {
    const { agent, events, cwd } = await makeAgent([
      await loadFixture("single-tool"),
      await loadFixture("final-answer"),
    ]);
    await Bun.write(join(cwd, "hello.txt"), "x");
    await agent.runTurn("go");
    const kinds = events.map((e) => e.type);
    expect(kinds.indexOf("tool_call")).toBeLessThan(kinds.indexOf("tool_result"));
    expect(kinds[kinds.length - 1]).toBe("turn_end");
  });
});
