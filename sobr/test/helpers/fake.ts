import type { Provider, ProviderRequest, StreamEvent } from "../../src/provider/types.ts";

/**
 * FakeAnthropic: replays scripted event streams (one script per API call) and
 * records every request for assertions. Same Provider interface as the live
 * provider, so loop tests exercise the real assemble/dispatch path.
 */
export class FakeAnthropic implements Provider {
  requests: ProviderRequest[] = [];
  private scripts: StreamEvent[][];
  private next = 0;

  constructor(scripts: StreamEvent[][]) {
    this.scripts = scripts;
  }

  async *stream(req: ProviderRequest, _signal?: AbortSignal): AsyncIterable<StreamEvent> {
    this.requests.push(structuredClone(req));
    const script = this.scripts[this.next++];
    if (!script) throw new Error(`FakeAnthropic: no script for call #${this.next}`);
    for (const ev of script) {
      yield ev;
    }
  }
}

export async function loadFixture(name: string): Promise<StreamEvent[]> {
  const path = new URL(`../fixtures/sse/${name}.json`, import.meta.url).pathname;
  return JSON.parse(await Bun.file(path).text());
}
