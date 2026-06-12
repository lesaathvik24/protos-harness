import type { ToolDef } from "../tools/types.ts";
import type { TeachLevel, TeachSession } from "./state.ts";
import { stakesClearLevel } from "./state.ts";
import { checkNeutrality } from "./neutrality.ts";
import type { ProfileStore } from "./profile.ts";

// The two teach tools, injected into the registry ONLY while teach is on.
// fork BLOCKS the loop on a real user pick; every validator failure is an
// is_error tool_result that doubles as the model's recovery prompt.

export interface ForkOption {
  label: string;
  what: string;
}

export interface ForkInput {
  decision: string;
  concept: string;
  stakes: TeachLevel;
  options: ForkOption[];
}

export interface TrivialInput {
  reason: string;
}

export interface TeachUi {
  /** Render numbered options, block until the user picks. Returns 0-based index. */
  askPick(req: { decision: string; options: ForkOption[] }): Promise<number>;
  /** Hard mode: free-text justification. */
  askText(prompt: string): Promise<string>;
}

export type TeachTraceFn = (ev: { type: "fork_surfaced" | "fork_rejected" | "fork_resolved" | "trivial_logged"; payload: Record<string, unknown> }) => void;

export interface TeachToolDeps {
  session: TeachSession;
  profile: ProfileStore;
  ui: TeachUi;
  trace?: TeachTraceFn;
}

const VALID_STAKES = new Set<string>(["L1", "L2", "L3"]);

export function makeForkTool(deps: TeachToolDeps): ToolDef<ForkInput> {
  return {
    name: "fork",
    description:
      "Surface a real technical decision to the user and BLOCK until they pick. " +
      "decision: the call in ~6 words. concept: short tag (e.g. sql-vs-nosql). " +
      "stakes: L1 architecture / L2 design / L3 idiom. options: 2-4 viable approaches, " +
      "each {label, what} where `what` is a terse factual line of what the option IS — " +
      "never why it's better (career/popularity framing is rejected). " +
      "Resolving a fork tags the write gate for one edit.",
    inputSchema: {
      type: "object",
      properties: {
        decision: { type: "string", description: "The decision, ~6 words" },
        concept: { type: "string", description: "Short concept tag, e.g. sql-vs-nosql" },
        stakes: { type: "string", enum: ["L1", "L2", "L3"], description: "L1 architecture, L2 design, L3 idiom" },
        options: {
          type: "array",
          description: "2-4 viable approaches",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "The approach, terse" },
              what: { type: "string", description: "Factual line of what it IS — no selling" },
            },
            required: ["label", "what"],
          },
        },
      },
      required: ["decision", "concept", "stakes", "options"],
    },
    mutates: false,
    async run(input) {
      const state = deps.session.state;
      if (!state.on) return { content: "Teach mode is off — fork is unavailable.", isError: true };

      const reject = (message: string) => {
        deps.trace?.({ type: "fork_rejected", payload: { decision: input.decision, reason: message } });
        return { content: message, isError: true };
      };

      // Validators (pure, pre-render) — deterministic code, not behavioral hope.
      if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 4) {
        return reject(`fork needs 2-4 options, got ${Array.isArray(input.options) ? input.options.length : 0}. One sane path = not a fork — call trivial instead.`);
      }
      if (!VALID_STAKES.has(input.stakes)) {
        return reject(`Invalid stakes "${input.stakes}" — use L1, L2 or L3.`);
      }
      if (!stakesClearLevel(input.stakes, state.level)) {
        return reject(`Stakes ${input.stakes} are below the active level ${state.level} — this is not fork-worthy right now. Call trivial with a ≤5-word reason.`);
      }
      if (await deps.profile.isMastered(input.concept)) {
        return reject(`Concept "${input.concept}" is mastered — do not re-fork settled ground. Call trivial with reason "mastered:${input.concept}".`);
      }
      const contamination = checkNeutrality([
        input.decision,
        ...input.options.flatMap((o) => [o.label, o.what]),
      ]);
      if (contamination) {
        return reject(`NEUTRALITY BLOCKED: option text carries ${contamination}. Fork descriptions must be engineering tradeoffs ONLY (no career/personal-advancement or popularity framing). Rewrite for an anonymous engineer and call fork again.`);
      }

      deps.trace?.({ type: "fork_surfaced", payload: { decision: input.decision, concept: input.concept, stakes: input.stakes, options: input.options.map((o) => o.label) } });

      // Block on the user.
      const pickIndex = await deps.ui.askPick({ decision: input.decision, options: input.options });
      const pick = input.options[pickIndex]!;
      let justification = "";
      if (state.hard) {
        justification = (await deps.ui.askText("why? (your technical reasoning for the pick)")).trim();
      }

      const record = await deps.profile.recordPick(input.concept, state.hard ? 2 : 1);
      const promoted = record.status === "mastered";

      await deps.profile.appendLog(
        `## FORK — ${input.decision}\n` +
          `- chose: ${pick.label}\n` +
          `- options: ${input.options.map((o) => o.label).join(" | ")}\n` +
          (justification ? `- justification: ${justification}\n` : "") +
          `- concept: ${input.concept} (${record.confidentPicks} pick(s)${promoted ? ", mastered" : ""})\n\n`,
      );

      deps.session.mintTag();
      deps.trace?.({ type: "fork_resolved", payload: { decision: input.decision, concept: input.concept, pick: pick.label, hard: state.hard, justification, promoted } });

      const big = input.stakes === "L1";
      const revealRule = big
        ? "BIG fork reveal: a compact tradeoff map, ≤5 bullets, each `axis: how the options rank` across the axes that matter for THIS app — honest about ties, no lecture. If the deciding priority is unknown AND crossing it changes the answer, ask it with ONE more fork (concrete buckets, e.g. ship speed · perf · learning); then a conditioned recommendation in ≤2 sentences — confirm their pick or flag the mismatch. They own the call."
        : "Small fork reveal: ≤2 sentences, a single expert call is fine.";

      return {
        content:
          `User picked option ${pickIndex + 1}: ${pick.label}.\n` +
          (state.hard
            ? `Hard-mode justification: "${justification}". Check it — correct any misconception in ≤2 sentences BEFORE the reveal.\n`
            : "") +
          revealRule +
          (promoted ? `\n(Concept "${input.concept}" just reached mastery — stop forking it; future occurrences are trivial "mastered:${input.concept}".)` : "") +
          "\nThe write gate is tagged for ONE edit.",
      };
    },
  };
}

export function makeTrivialTool(deps: TeachToolDeps): ToolDef<TrivialInput> {
  return {
    name: "trivial",
    description:
      "Classify the next write/edit as not-a-fork (single sane path, or a mastered concept — " +
      'use reason "mastered:<concept>"). reason: ≤5 words. Tags the write gate for one edit. Returns instantly.',
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "≤5 words" },
      },
      required: ["reason"],
    },
    mutates: false,
    async run(input) {
      const state = deps.session.state;
      if (!state.on) return { content: "Teach mode is off — trivial is unavailable.", isError: true };
      const reason = (input.reason ?? "").trim();
      const words = reason === "" ? 0 : reason.split(/\s+/).length;
      if (words === 0 || words > 5) {
        return { content: `trivial reason must be 1-5 words, got ${words}. Be terse.`, isError: true };
      }
      await deps.profile.appendLog(`- TRIVIAL: ${reason}\n`);
      deps.session.mintTag();
      deps.trace?.({ type: "trivial_logged", payload: { reason } });
      return { content: "Logged. The write gate is tagged for ONE edit — proceed." };
    },
  };
}
