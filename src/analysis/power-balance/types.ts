// Spec: specs/012-cylinder-health/spec.md (CY-2xx, CY-3xx)

/** Interlock identifiers; the UI translates them. */
export type Interlock = "not-engine" | "busy" | "cold" | "rpm-range" | "moving" | "no-data";
export type InterlockWarning = "not-in-park-neutral";

export type AbortReason = "stall-risk" | "moving" | "overheat" | "timeout" | "user" | "hidden" | "error" | "interlock";

export interface CutMeasurement {
  cylinder: number;
  round: number;
  baselineRpm: number;
  /** Mean rpm over the first measureWindowMs of the cut. */
  cutRpm: number;
  minRpm: number;
  aacBefore?: number;
  aacDuring?: number;
}

export type CylinderStatus = "ok" | "warn" | "bad";

export interface CylinderResult {
  cylinder: number;
  dropRpm: number;
  dropPct: number;
  minRpm: number;
  aacRise?: number;
  status: CylinderStatus;
}

export interface PowerBalanceResult {
  date: string;
  partNumber?: string;
  odometerKm?: number;
  rounds: number;
  dryRun: boolean;
  cylinders: CylinderResult[];
  inconclusive: boolean;
  /** CY-205: restore could not be confirmed — user must cycle the ignition. */
  restoreUnconfirmed: boolean;
  aborted?: AbortReason;
  mode: "combined" | "separate";
}
