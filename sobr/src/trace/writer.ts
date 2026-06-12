import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { TraceEmitter, TraceEvent } from "./events.ts";

/**
 * JSONL writer: ~/.sobr/sessions/<id>/trace.jsonl.
 * emit() is fire-and-forget but writes are chained so line order always
 * matches emit order. flush() awaits the chain (tests + clean shutdown).
 */
export class TraceWriter implements TraceEmitter {
  private chain: Promise<void> = Promise.resolve();
  private path: string;

  constructor(public readonly dir: string) {
    this.path = join(dir, "trace.jsonl");
  }

  emit(ev: TraceEvent): void {
    this.chain = this.chain.then(async () => {
      await mkdir(this.dir, { recursive: true });
      await appendFile(this.path, JSON.stringify(ev) + "\n");
    });
  }

  flush(): Promise<void> {
    return this.chain;
  }
}

export async function readTrace(dir: string): Promise<TraceEvent[]> {
  const file = Bun.file(join(dir, "trace.jsonl"));
  if (!(await file.exists())) return [];
  const text = await file.text();
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l));
}
