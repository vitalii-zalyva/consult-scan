// Spec: specs/012-cylinder-health/spec.md (CY-1xx, CY-2xx, CY-3xx)
import type { CutMeasurement } from "@/analysis/power-balance";
import type { ParamValues } from "@/protocol/registers";

export interface PowerBalanceOptions {
  /** CY-207: cylinder 1 only, 2 s cut. */
  dryRun: boolean;
  rounds: number;
  /** Requested cut length; clamped to `limits.maxCutMs`. */
  cutMs?: number;
  mode?: "combined" | "separate";
  odometerKm?: number;
}

/** Timing limits; production always uses PB_LIMITS. Tests may pass shorter ones. */
export type PbLimits = Record<
  "maxCutMs" | "minPauseMs" | "baselineMs" | "measureWindowMs" | "restoreWithinMs" | "maxRounds",
  number
>;

export type PbPhase =
  | { kind: "baseline"; cylinder: number; round: number }
  | { kind: "cut"; cylinder: number; round: number }
  | { kind: "recover"; cylinder: number; round: number }
  | { kind: "restoring" }
  | { kind: "done" };

export interface PbEvents {
  onPhase?: (p: PbPhase) => void;
  onCut?: (m: CutMeasurement) => void;
}

export interface Collected {
  t: number;
  v: ParamValues;
}
