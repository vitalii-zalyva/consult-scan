// Spec: specs/001-consult-protocol/spec.md
import type { ConsultTimings } from "./types";

export const CMD = {
  INIT: [0xff, 0xff, 0xef],
  INIT_PREFIX: [0xff, 0xff],
  ENGINE_UNIT: 0xef,
  INIT_ACK: 0x10,
  READ_REGISTER: 0x5a,
  ECU_PART_NUMBER: 0xd0,
  READ_FAULT_CODES: 0xd1,
  CLEAR_FAULT_CODES: 0xc1,
  GO: 0xf0,
  STOP: 0x30,
  STOP_ACK: 0xcf,
  FRAME_START: 0xff,
  INVALID: 0xfe,
} as const;

export const DEFAULT_TIMINGS: ConsultTimings = {
  initTimeoutMs: 1500,
  initAttempts: 3,
  byteTimeoutMs: 500,
  frameTimeoutMs: 1000,
  quietMs: 150,
};
