import { ByteQueue } from "@/transport/byte-queue";
import { CONSULT_SERIAL_OPTIONS } from "@/transport/constants";
import type { Transport } from "@/transport/types";

/**
 * Web Serial transport (Chrome/Edge). Uses the macOS serial driver, so the cable
 * must enumerate as /dev/cu.usbserial-* (standard FTDI / CH34x).
 * Spec: specs/002-transports/spec.md (TR-1xx)
 */
export class WebSerialTransport implements Transport {
  readonly kind = "web-serial" as const;
  onTraffic?: (dir: "tx" | "rx", bytes: Uint8Array) => void;

  private queue = new ByteQueue();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readLoop: Promise<void> | null = null;

  constructor(private readonly port: SerialPort) {}

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  /** Must be called from a user gesture (button click). */
  static async request(): Promise<WebSerialTransport> {
    const port = await navigator.serial.requestPort();
    return new WebSerialTransport(port);
  }

  describe(): string {
    const info = this.port.getInfo();
    const hex = (n?: number) => (n === undefined ? "?" : n.toString(16).padStart(4, "0"));
    return `USB ${hex(info.usbVendorId)}:${hex(info.usbProductId)}`;
  }

  async open(): Promise<void> {
    await this.port.open({ ...CONSULT_SERIAL_OPTIONS, bufferSize: 4096 });
    this.readLoop = this.pump();
  }

  private async pump(): Promise<void> {
    while (this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) return;
          if (value && value.length) {
            this.onTraffic?.("rx", value);
            this.queue.push(value);
          }
        }
      } catch (err) {
        // Framing/parity errors are recoverable: re-acquire the reader.
        if (err instanceof DOMException && err.name !== "NetworkError") continue;
        this.queue.fail(err instanceof Error ? err : new Error(String(err)));
        return;
      } finally {
        this.reader.releaseLock();
        this.reader = null;
      }
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    const writable = this.port.writable;
    if (!writable) throw new Error("Port not open");
    const writer = writable.getWriter();
    try {
      this.onTraffic?.("tx", bytes);
      await writer.write(bytes);
    } finally {
      writer.releaseLock();
    }
  }

  read(count: number, timeoutMs: number): Promise<Uint8Array> {
    return this.queue.read(count, timeoutMs);
  }

  drain(): void {
    this.queue.drain();
  }

  async close(): Promise<void> {
    this.queue.fail(new Error("Port closed"));
    try {
      await this.reader?.cancel();
    } catch {
      /* already closed */
    }
    await this.readLoop?.catch(() => undefined);
    await this.port.close().catch(() => undefined);
  }
}
