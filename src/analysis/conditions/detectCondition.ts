/**
 * Detects the engine operating condition the reference values depend on.
 * Spec: specs/005-reference-ranges/spec.md (RR-1xx)
 */
import type { ParamValues } from "@/protocol/registers";

import { CLOSED_TPS_V, IDLE_MAX_RPM, IDLE_MAX_RPM_NO_TPS, WARM_COOLANT_C } from "./constants";
import type { Condition } from "./types";

export function detectCondition(v: ParamValues): Condition {
  const rpm = v.rpm ?? 0;
  if (rpm < 50) return "engine-off";
  if (rpm < 400) return "cranking";
  if ((v.speed ?? 0) > 3) return "driving";
  if ((v.coolant ?? WARM_COOLANT_C) < WARM_COOLANT_C) return "cold";
  // RR-102: idle = throttle closed, not a fixed rpm — the A32 idles at 925–1025 rpm and a
  // 1000 rpm cut flipped the condition (and every idle range) 130 times in 75 s (2026-10-13).
  if (v.tps !== undefined ? v.tps <= CLOSED_TPS_V && rpm < IDLE_MAX_RPM : rpm < IDLE_MAX_RPM_NO_TPS) return "warm-idle";
  if (rpm >= 1800 && rpm <= 2200) return "warm-2000";
  return "warm-other";
}
