// Spec: specs/013-a32-register-corrections/spec.md (RC-101..107)
import { A32_LOGS } from "./constants";
import type { SuspectEntry } from "./types";

/** RC-101: from the first A32 car session; 0x02/03, 0x34, 0x38 moved to corrected decoders (RC-401..403). */
export const SUSPECT_REGISTERS: readonly SuspectEntry[] = [
  {
    ecu: "23710-44U01",
    param: "wastegate",
    reason: "Constant 180 % at idle; the VQ30DE has no turbocharger. PLMS A32 list: register valid, meaning unknown.",
    evidence: A32_LOGS,
  },
  {
    ecu: "23710-44U01",
    param: "o2HeaterB1",
    reason: "Constant byte 104 (engine off: 8), not an on/off value. PLMS A32 list: register exists, scaling unknown.",
    evidence: A32_LOGS,
  },
  {
    ecu: "23710-44U01",
    param: "o2HeaterB2",
    reason: "Constant byte 128 with engine off and running, not an on/off value.",
    evidence: A32_LOGS,
  },
];
