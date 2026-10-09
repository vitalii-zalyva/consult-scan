// Spec: specs/003-ecu-simulator/spec.md (SIM-1xx), 008 (deep scan), 009 (control units)
import type { UnitId } from "@/protocol/units";

export type Pending =
  { kind: "registers"; registers: number[] } | { kind: "part" } | { kind: "dtc" } | { kind: "clear" };

export interface FakeEcuOptions {
  /** Interval between stream frames, ms. A real ECU is roughly baud-limited (~20-60 ms). */
  frameIntervalMs?: number;
  supported?: ReadonlySet<number>;
  faultCodes?: Array<[code: number, startsSince: number]>;
  /** Control units present on the bus (default engine + A/T). */
  units?: readonly UnitId[];
}
