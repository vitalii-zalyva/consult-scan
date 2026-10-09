/**
 * Detects the engine operating condition the reference values depend on.
 * Spec: specs/005-reference-ranges/spec.md (RR-1xx)
 */
import type { ParamValues } from "@/protocol/registers";

import { WARM_COOLANT_C } from "./constants";
import type { Condition } from "./types";

export function detectCondition(v: ParamValues): Condition {
  const rpm = v.rpm ?? 0;
  if (rpm < 50) return "engine-off";
  if (rpm < 400) return "cranking";
  if ((v.speed ?? 0) > 3) return "driving";
  if ((v.coolant ?? WARM_COOLANT_C) < WARM_COOLANT_C) return "cold";
  if (rpm < 1000) return "warm-idle";
  if (rpm >= 1800 && rpm <= 2200) return "warm-2000";
  return "warm-other";
}
