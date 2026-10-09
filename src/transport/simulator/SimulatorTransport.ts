import type { FakeEcuOptions } from "@/simulator/fake-ecu";
import { FakeEcu } from "@/simulator/fake-ecu";
import { ByteQueue } from "@/transport/byte-queue";
import type { Transport } from "@/transport/types";

/** In-memory transport wired to a FakeEcu. Spec: specs/003-ecu-simulator/spec.md */
export class SimulatorTransport implements Transport {
  readonly kind = "simulator" as const;
  onTraffic?: (dir: "tx" | "rx", bytes: Uint8Array) => void;
  readonly ecu: FakeEcu;
  private queue = new ByteQueue();

  constructor(opts: FakeEcuOptions = {}) {
    this.ecu = new FakeEcu((bytes) => {
      // Deliver asynchronously, like a real serial port.
      setTimeout(() => {
        this.onTraffic?.("rx", bytes);
        this.queue.push(bytes);
      }, 1);
    }, opts);
  }

  describe(): string {
    return "Simulated VQ30DE ECU";
  }

  async open(): Promise<void> {
    this.ecu.start();
  }

  async close(): Promise<void> {
    this.ecu.stop();
    this.queue.fail(new Error("Port closed"));
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.onTraffic?.("tx", bytes);
    this.ecu.receive(bytes);
  }

  read(count: number, timeoutMs: number): Promise<Uint8Array> {
    return this.queue.read(count, timeoutMs);
  }

  drain(): void {
    this.queue.drain();
  }
}
