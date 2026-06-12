import { homedir } from "node:os";
import { join } from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { readTrace } from "../trace/writer.ts";
import type { TraceEvent } from "../trace/events.ts";

export interface SessionMeta {
  id: string;
  startedAt: string;
  cwd: string;
  model: string;
  provider: string;
}

export function sessionsRoot(home = homedir()): string {
  return join(home, ".sobr", "sessions");
}

export function newSessionId(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

export class SessionStore {
  constructor(public readonly root: string = sessionsRoot()) {}

  dirOf(id: string): string {
    return join(this.root, id);
  }

  async create(meta: SessionMeta): Promise<string> {
    const dir = this.dirOf(meta.id);
    await mkdir(dir, { recursive: true });
    await Bun.write(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
    return dir;
  }

  async list(): Promise<SessionMeta[]> {
    let entries: string[];
    try {
      entries = await readdir(this.root);
    } catch {
      return [];
    }
    const metas: SessionMeta[] = [];
    for (const id of entries) {
      const file = Bun.file(join(this.root, id, "meta.json"));
      if (await file.exists()) {
        try {
          metas.push(JSON.parse(await file.text()));
        } catch {
          // skip corrupt sessions
        }
      }
    }
    metas.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return metas;
  }

  /** Exact id or unique prefix. */
  async resolve(prefix: string): Promise<string> {
    const metas = await this.list();
    const hits = metas.filter((m) => m.id === prefix || m.id.startsWith(prefix));
    if (hits.length === 0) throw new Error(`No session matching "${prefix}"`);
    const exact = hits.find((m) => m.id === prefix);
    if (exact) return exact.id;
    if (hits.length > 1) throw new Error(`Ambiguous session "${prefix}": ${hits.map((h) => h.id).join(", ")}`);
    return hits[0]!.id;
  }

  async trace(id: string): Promise<TraceEvent[]> {
    return readTrace(this.dirOf(id));
  }
}
