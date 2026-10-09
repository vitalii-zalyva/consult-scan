import { TimeoutError } from "@/transport/errors";

import type { Waiter } from "./types";

/** FIFO of received bytes with async, timeout-bounded reads. One reader at a time. */
export class ByteQueue {
  private buffer: number[] = [];
  private waiter: Waiter | null = null;

  push(bytes: Uint8Array): void {
    for (const b of bytes) this.buffer.push(b);
    this.flush();
  }

  read(count: number, timeoutMs: number): Promise<Uint8Array> {
    if (this.waiter) return Promise.reject(new Error("Concurrent read on ByteQueue"));
    if (this.buffer.length >= count) {
      return Promise.resolve(Uint8Array.from(this.buffer.splice(0, count)));
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new TimeoutError(`Timed out waiting for ${count} byte(s), got ${this.buffer.length}`));
      }, timeoutMs);
      this.waiter = { count, resolve, reject, timer };
    });
  }

  drain(): void {
    this.buffer = [];
  }

  /** Rejects a pending read, e.g. when the port closes. */
  fail(err: Error): void {
    const w = this.waiter;
    if (!w) return;
    this.waiter = null;
    clearTimeout(w.timer);
    w.reject(err);
  }

  get size(): number {
    return this.buffer.length;
  }

  private flush(): void {
    const w = this.waiter;
    if (!w || this.buffer.length < w.count) return;
    this.waiter = null;
    clearTimeout(w.timer);
    w.resolve(Uint8Array.from(this.buffer.splice(0, w.count)));
  }
}
