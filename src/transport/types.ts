/**
 * Byte-level transport used by the Consult protocol layer.
 * Spec: specs/002-transports/spec.md
 */

export interface Transport {
  readonly kind: TransportKind;
  open(): Promise<void>;
  close(): Promise<void>;
  write(bytes: Uint8Array): Promise<void>;
  /** Resolves with exactly `count` bytes or rejects with TimeoutError. */
  read(count: number, timeoutMs: number): Promise<Uint8Array>;
  /** Discards any bytes received but not yet read. */
  drain(): void;
  /** Optional raw traffic observer (TX and RX), used by the traffic log. */
  onTraffic?: (dir: "tx" | "rx", bytes: Uint8Array) => void;
}

export type TransportKind = "web-serial" | "web-usb-ftdi" | "simulator";
