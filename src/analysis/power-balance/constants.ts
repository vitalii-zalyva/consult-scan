// Spec: specs/012-cylinder-health/spec.md (CY-2xx, CY-3xx)
import { WARM_COOLANT_C } from "@/analysis/conditions";

export const PB_LIMITS = {
  minCoolantC: WARM_COOLANT_C,
  minIdleRpm: 550,
  maxIdleRpm: 1000,
  abortRpm: 450,
  abortCoolantC: 105,
  maxCutMs: 4000,
  minPauseMs: 5000,
  maxRounds: 2,
  /** CY-205: recovered if rpm ≥ baseline − clamp(30 % of the cut drop, 25, 100). */
  restoreToleranceRpm: 100,
  restoreToleranceMinRpm: 25,
  restoreToleranceFraction: 0.3,
  restoreWithinMs: 5000,
  measureWindowMs: 2000,
  baselineMs: 3000,
} as const;

export const WEAK_BAD = 0.5;
export const WEAK_WARN = 0.7;
export const INCONCLUSIVE_RPM = 40;
