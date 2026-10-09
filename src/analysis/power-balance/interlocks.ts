// Spec: specs/012-cylinder-health/spec.md (CY-2xx, CY-3xx)
import { mean } from "@/analysis/diagnosis";
import type { ParamValues } from "@/protocol/registers";

import { PB_LIMITS } from "./constants";
import type { AbortReason, Interlock, InterlockWarning } from "./types";

/** CY-201 */
export function checkInterlocks(
  v: ParamValues,
  ctx: { isEngine: boolean; busy: boolean },
): { blocked: Interlock[]; warnings: InterlockWarning[] } {
  const blocked: Interlock[] = [];
  const warnings: InterlockWarning[] = [];
  if (!ctx.isEngine) blocked.push("not-engine");
  if (ctx.busy) blocked.push("busy");
  // Speed is required too: an unknown speed must not be treated as "stationary".
  if (v.rpm === undefined || v.coolant === undefined || v.speed === undefined) blocked.push("no-data");
  else {
    if (v.coolant < PB_LIMITS.minCoolantC) blocked.push("cold");
    if (v.rpm < PB_LIMITS.minIdleRpm || v.rpm > PB_LIMITS.maxIdleRpm) blocked.push("rpm-range");
  }
  if ((v.speed ?? 0) > 0) blocked.push("moving");
  // A/T: 0x13 bit 2 = Park/Neutral switch (position unverified) → warning only.
  if (v.bits13 !== undefined && ((v.bits13 >> 2) & 1) === 0) warnings.push("not-in-park-neutral");
  return { blocked, warnings };
}

/** CY-205: allowed shortfall after restore, relative to how deep the cut went. */
export function restoreTolerance(dropRpm: number): number {
  return Math.min(
    PB_LIMITS.restoreToleranceRpm,
    Math.max(PB_LIMITS.restoreToleranceMinRpm, dropRpm * PB_LIMITS.restoreToleranceFraction),
  );
}

/** CY-205: mean rpm over the last part of the restore window must be back near the baseline. */
export function hasRecovered(
  samples: readonly { t: number; rpm: number }[],
  baselineRpm: number,
  dropRpm: number,
  withinMs: number,
): boolean {
  const t0 = samples[0]?.t;
  if (t0 === undefined) return false;
  const span = Math.min(1000, withinMs / 2);
  const tail = samples.filter((s) => s.t - t0 <= withinMs && s.t - t0 >= withinMs - span);
  const m = mean(tail.map((s) => s.rpm));
  return m !== undefined && m >= baselineRpm - restoreTolerance(dropRpm);
}

/** CY-204: checked on every frame while a cylinder is cut or the engine is recovering. */
export function abortReason(v: ParamValues): AbortReason | null {
  if (v.rpm !== undefined && v.rpm < PB_LIMITS.abortRpm) return "stall-risk";
  if ((v.speed ?? 0) > 0) return "moving";
  if ((v.coolant ?? 0) > PB_LIMITS.abortCoolantC) return "overheat";
  return null;
}
