// Spec: specs/013-a32-register-corrections/spec.md (RC-101..107)
import type { ParamId } from "@/protocol/registers";

export interface SuspectEntry {
  /** ECU part number without the ROM suffix, e.g. "23710-44U01". */
  ecu: string;
  param: ParamId;
  reason: string;
  /** Car recording the decision is based on. */
  evidence: string;
}
