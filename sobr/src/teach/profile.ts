import { join } from "node:path";
import { mkdir, appendFile } from "node:fs/promises";
import { homedir } from "node:os";

// Cross-session learner model: ~/.sobr/teach/profile.json (machine) plus a
// human-readable log.md in the proven SKILL.md FORK/TRIVIAL format (the demo
// artifact). 3 confident picks → mastered; Hard-mode picks weigh double
// (SKILL.md: "Weight a Hard justification above a Reveal pick").

export type ConceptStatus = "learning" | "mastered" | "shaky";

export interface ConceptRecord {
  status: ConceptStatus;
  confidentPicks: number;
  fumbles: number;
}

export interface Profile {
  concepts: Record<string, ConceptRecord>;
}

export const MASTERY_THRESHOLD = 3;

export function teachRoot(home = homedir()): string {
  return join(home, ".sobr", "teach");
}

export class ProfileStore {
  constructor(public readonly dir: string = teachRoot()) {}

  private get profilePath() {
    return join(this.dir, "profile.json");
  }

  async load(): Promise<Profile> {
    const file = Bun.file(this.profilePath);
    if (!(await file.exists())) return { concepts: {} };
    try {
      return JSON.parse(await file.text());
    } catch {
      return { concepts: {} };
    }
  }

  async save(profile: Profile): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await Bun.write(this.profilePath, JSON.stringify(profile, null, 2));
  }

  async isMastered(concept: string): Promise<boolean> {
    const profile = await this.load();
    return profile.concepts[concept]?.status === "mastered";
  }

  /** Returns the updated record; promotion to mastered happens here, deterministically. */
  async recordPick(concept: string, weight = 1): Promise<ConceptRecord> {
    const profile = await this.load();
    const rec = profile.concepts[concept] ?? { status: "learning" as ConceptStatus, confidentPicks: 0, fumbles: 0 };
    rec.confidentPicks += weight;
    if (rec.status !== "mastered" && rec.confidentPicks >= MASTERY_THRESHOLD) rec.status = "mastered";
    profile.concepts[concept] = rec;
    await this.save(profile);
    return { ...rec };
  }

  async recordFumble(concept: string): Promise<ConceptRecord> {
    const profile = await this.load();
    const rec = profile.concepts[concept] ?? { status: "learning" as ConceptStatus, confidentPicks: 0, fumbles: 0 };
    rec.fumbles += 1;
    rec.status = "shaky";
    profile.concepts[concept] = rec;
    await this.save(profile);
    return { ...rec };
  }

  /** Append to the human-readable decision log (SKILL.md format). */
  async appendLog(text: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    const logPath = join(this.dir, "log.md");
    if (!(await Bun.file(logPath).exists())) {
      await Bun.write(logPath, "# sobr teach decision log\n\n");
    }
    await appendFile(logPath, text);
  }

  render(profile: Profile): string {
    const entries = Object.entries(profile.concepts);
    if (entries.length === 0) return "# learner profile\n\n(empty — no forks resolved yet)";
    const section = (status: ConceptStatus) =>
      entries
        .filter(([, r]) => r.status === status)
        .map(([c, r]) =>
          status === "shaky" ? `- ${c} — fumbled ${r.fumbles}x` : `- ${c} — ${r.confidentPicks} confident pick(s)`,
        )
        .join("\n");
    return `# learner profile\n\n## mastered\n${section("mastered")}\n\n## learning\n${section("learning")}\n\n## shaky\n${section("shaky")}`;
  }
}
