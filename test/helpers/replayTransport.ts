import { readFileSync } from "node:fs";

import type { Transport } from "@/transport";
import { ByteQueue } from "@/transport";

export interface LogStep {
  dir: "W" | "R";
  bytes: number[];
}

export function parseLog(text: string): LogStep[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [dir, hexStr = ""] = line.split(/\s+/);
      const bytes = hexStr.match(/../g)?.map((h) => parseInt(h, 16)) ?? [];
      return { dir: dir as "W" | "R", bytes };
    });
}

export function loadFixture(name: string): LogStep[] {
  return parseLog(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));
}

/**
 * Replays a W/R byte log: each write must match the next W line, and the R lines
 * that follow it are delivered. Writes of a lone STOP (0x30) that the log does not
 * expect are tolerated (the client sends one defensively before init).
 */
export class ReplayTransport implements Transport {
  readonly kind = "simulator" as const;
  readonly writes: number[][] = [];
  private queue = new ByteQueue();
  private pos = 0;

  constructor(private readonly steps: LogStep[]) {}

  async open(): Promise<void> {}
  async close(): Promise<void> {}
  drain(): void {
    this.queue.drain();
  }
  read(count: number, timeoutMs: number): Promise<Uint8Array> {
    return this.queue.read(count, timeoutMs);
  }

  async write(bytes: Uint8Array): Promise<void> {
    const sent = [...bytes];
    this.writes.push(sent);
    const step = this.steps[this.pos];
    if (!step || step.dir !== "W" || step.bytes.join() !== sent.join()) {
      if (sent.length === 1 && sent[0] === 0x30) return;
      throw new Error(
        `Replay mismatch at step ${this.pos}: wrote ${hex(sent)}, log expects ${step ? `${step.dir} ${hex(step.bytes)}` : "end"}`,
      );
    }
    this.pos++;
    while (this.steps[this.pos]?.dir === "R") {
      this.queue.push(Uint8Array.from(this.steps[this.pos]!.bytes));
      this.pos++;
    }
  }

  get finished(): boolean {
    return this.pos >= this.steps.length;
  }
}

const hex = (b: number[]) => b.map((x) => x.toString(16).padStart(2, "0")).join("");
