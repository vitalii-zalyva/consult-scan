import { ByteQueue } from "@/transport/byte-queue";
import type { Transport } from "@/transport/types";

import {
  BAUD_9600_VALUE,
  DATA_8N1,
  MODEM_DTR_RTS_ON,
  PACKET_STATUS_BYTES,
  SIO_RESET,
  SIO_SET_BAUD_RATE,
  SIO_SET_DATA,
  SIO_SET_FLOW_CTRL,
  SIO_SET_LATENCY_TIMER,
  SIO_SET_MODEM_CTRL,
} from "./constants";

export class WebUsbFtdiTransport implements Transport {
  readonly kind = "web-usb-ftdi" as const;
  onTraffic?: (dir: "tx" | "rx", bytes: Uint8Array) => void;

  private queue = new ByteQueue();
  private running = false;
  private inEndpoint = 1;
  private outEndpoint = 2;
  private packetSize = 64;
  private interfaceNumber = 0;

  constructor(private readonly device: USBDevice) {}

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "usb" in navigator;
  }

  static async request(): Promise<WebUsbFtdiTransport> {
    const device = await navigator.usb.requestDevice({ filters: [] });
    return new WebUsbFtdiTransport(device);
  }

  describe(): string {
    const hex = (n: number) => n.toString(16).padStart(4, "0");
    return `WebUSB ${hex(this.device.vendorId)}:${hex(this.device.productId)} ${this.device.productName ?? ""}`.trim();
  }

  async open(): Promise<void> {
    const d = this.device;
    await d.open();
    if (d.configuration === null) await d.selectConfiguration(1);
    const iface = d.configuration?.interfaces[0];
    if (!iface) throw new Error("FTDI device has no USB interface");
    this.interfaceNumber = iface.interfaceNumber;
    await d.claimInterface(this.interfaceNumber);
    for (const ep of iface.alternate.endpoints) {
      if (ep.type !== "bulk") continue;
      if (ep.direction === "in") {
        this.inEndpoint = ep.endpointNumber;
        this.packetSize = ep.packetSize;
      } else {
        this.outEndpoint = ep.endpointNumber;
      }
    }
    const port = this.interfaceNumber + 1;
    await this.control(SIO_RESET, 0, port);
    await this.control(SIO_SET_BAUD_RATE, BAUD_9600_VALUE, 0);
    await this.control(SIO_SET_DATA, DATA_8N1, port);
    await this.control(SIO_SET_FLOW_CTRL, 0, port);
    await this.control(SIO_SET_MODEM_CTRL, MODEM_DTR_RTS_ON, port);
    await this.control(SIO_SET_LATENCY_TIMER, 2, port);
    this.running = true;
    void this.pump();
  }

  private async control(request: number, value: number, index: number): Promise<void> {
    const res = await this.device.controlTransferOut({
      requestType: "vendor",
      recipient: "device",
      request,
      value,
      index,
    });
    if (res.status !== "ok") throw new Error(`FTDI control 0x${request.toString(16)} failed: ${res.status}`);
  }

  private async pump(): Promise<void> {
    while (this.running) {
      try {
        const res = await this.device.transferIn(this.inEndpoint, this.packetSize * 4);
        if (!res.data) continue;
        const payload = stripFtdiStatus(
          new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength),
          this.packetSize,
        );
        if (payload.length) {
          this.onTraffic?.("rx", payload);
          this.queue.push(payload);
        }
      } catch (err) {
        if (!this.running) return;
        this.queue.fail(err instanceof Error ? err : new Error(String(err)));
        return;
      }
    }
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.onTraffic?.("tx", bytes);
    const res = await this.device.transferOut(this.outEndpoint, bytes);
    if (res.status !== "ok") throw new Error(`USB write failed: ${res.status}`);
  }

  read(count: number, timeoutMs: number): Promise<Uint8Array> {
    return this.queue.read(count, timeoutMs);
  }

  drain(): void {
    this.queue.drain();
  }

  async close(): Promise<void> {
    this.running = false;
    this.queue.fail(new Error("Port closed"));
    await this.device.releaseInterface(this.interfaceNumber).catch(() => undefined);
    await this.device.close().catch(() => undefined);
  }
}

/** Every max-packet-size chunk from an FTDI chip starts with 2 modem-status bytes. */
export function stripFtdiStatus(data: Uint8Array, packetSize: number): Uint8Array {
  const out: number[] = [];
  for (let offset = 0; offset < data.length; offset += packetSize) {
    const end = Math.min(offset + packetSize, data.length);
    for (let i = offset + PACKET_STATUS_BYTES; i < end; i++) out.push(data[i]!);
  }
  return Uint8Array.from(out);
}
