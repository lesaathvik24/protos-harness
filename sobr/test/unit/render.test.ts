import { describe, expect, test } from "bun:test";
import { render } from "../../src/ui/render.ts";
import { renderStatus } from "../../src/ui/status.ts";

describe("render (pure — replay depends on this)", () => {
  test("text deltas pass through verbatim", () => {
    expect(render({ type: "text_delta", text: "abc" })).toBe("abc");
  });

  test("tool_call shows name and a digest of the input", () => {
    const out = render({ type: "tool_call", id: "t", name: "bash", input: { command: "echo hi" } });
    expect(out).toContain("bash");
    expect(out).toContain("echo hi");
  });

  test("error results render distinctly from success", () => {
    const ok = render({ type: "tool_result", id: "t", name: "read", content: "fine", isError: false });
    const err = render({ type: "tool_result", id: "t", name: "read", content: "boom", isError: true });
    expect(ok).not.toBe(err);
    expect(err).toContain("boom");
  });

  test("same event always renders the same string (purity)", () => {
    const ev = { type: "tool_call" as const, id: "t", name: "glob", input: { pattern: "*" } };
    expect(render(ev)).toBe(render(ev));
  });
});

describe("status line", () => {
  test("shows model, token counts and cache_read", () => {
    const s = renderStatus("claude-sonnet-4-6", {
      inputTokens: 1500,
      outputTokens: 300,
      cacheReadTokens: 12000,
      cacheWriteTokens: 800,
    });
    expect(s).toContain("claude-sonnet-4-6");
    expect(s).toContain("cache_read 12.0k");
    expect(s).toContain("out 300");
  });
});
