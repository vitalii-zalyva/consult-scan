// Spec: specs/002-transports/spec.md

export const CONSULT_SERIAL_OPTIONS = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: "none",
  flowControl: "none",
} as const;
