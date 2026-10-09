// Spec: specs/011-diagnosis/spec.md. Thresholds are heuristics, not FSM values.
import type { Condition } from "@/analysis/conditions";
import { detectCondition } from "@/analysis/conditions";
import type { Sample } from "@/analysis/evaluate";
import type { ParamId } from "@/protocol/registers";

import { LOOKBACK_MS, STEADY_MIN_MS, STEADY_WINDOW_MS } from "./constants";

export const conditionCache = new WeakMap<Sample, Condition>();
export const conditionOf = (s: Sample): Condition => {
  let c = conditionCache.get(s);
  if (!c) {
    c = detectCondition(s.values);
    conditionCache.set(s, c);
  }
  return c;
};

/**
 * DX-102: the most recent continuous stretch of `cond` (≥ minMs) within the lookback,
 * trimmed to its last `windowMs`. Null if none.
 */
export function lastSteady(
  samples: readonly Sample[],
  cond: Condition,
  minMs = STEADY_MIN_MS,
  windowMs = STEADY_WINDOW_MS,
  lookbackMs = LOOKBACK_MS,
): Sample[] | null {
  const latest = samples.at(-1);
  if (!latest) return null;
  let end = -1;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    if (s.t < latest.t - lookbackMs) break;
    if (conditionOf(s) === cond) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  let start = end;
  while (start > 0 && conditionOf(samples[start - 1]!) === cond) start--;
  const run = samples.slice(start, end + 1);
  if (run.at(-1)!.t - run[0]!.t < minMs) return null;
  const cut = run.at(-1)!.t - windowMs;
  return run.filter((s) => s.t >= cut);
}

export const nums = (w: readonly Sample[], p: ParamId) =>
  w.flatMap((s) => (s.values[p] === undefined ? [] : [s.values[p]]));
export const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
export const stdev = (xs: readonly number[]) => {
  const m = mean(xs);
  return m === undefined || xs.length < 2
    ? undefined
    : Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
export const avg = (w: readonly Sample[], p: ParamId) => mean(nums(w, p));
/** Average of both banks where available. */
export const avgBanks = (w: readonly Sample[], a: ParamId, b: ParamId) => mean([...nums(w, a), ...nums(w, b)]);
