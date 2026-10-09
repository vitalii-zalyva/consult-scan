/**
 * Power balance test: interlocks and result analysis (pure functions).
 * Spec: specs/012-cylinder-health/spec.md (CY-2xx, CY-3xx)
 */
import { mean } from "@/analysis/diagnosis";

import { INCONCLUSIVE_RPM, WEAK_BAD, WEAK_WARN } from "./constants";
import type { CutMeasurement, CylinderResult, CylinderStatus } from "./types";

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** CY-302..305: per-cylinder drop averaged over rounds, weak cylinder classification. */
export function analyzeCuts(cuts: readonly CutMeasurement[]): { cylinders: CylinderResult[]; inconclusive: boolean } {
  const byCyl = new Map<number, CutMeasurement[]>();
  for (const c of cuts) byCyl.set(c.cylinder, [...(byCyl.get(c.cylinder) ?? []), c]);
  const base = [...byCyl.entries()]
    .sort(([a], [b]) => a - b)
    .map(([cylinder, ms]) => {
      const drops = ms.map((m) => m.baselineRpm - m.cutRpm);
      const baseline = mean(ms.map((m) => m.baselineRpm)) ?? 0;
      const dropRpm = mean(drops) ?? 0;
      const aacB = mean(ms.flatMap((m) => (m.aacBefore === undefined ? [] : [m.aacBefore])));
      const aacD = mean(ms.flatMap((m) => (m.aacDuring === undefined ? [] : [m.aacDuring])));
      return {
        cylinder,
        dropRpm,
        dropPct: baseline ? (dropRpm / baseline) * 100 : 0,
        minRpm: Math.min(...ms.map((m) => m.minRpm)),
        ...(aacB !== undefined && aacD !== undefined ? { aacRise: aacD - aacB } : {}),
      };
    });
  const inconclusive = base.length > 0 && base.every((c) => c.dropRpm < INCONCLUSIVE_RPM);
  const cylinders = base.map((c) => {
    const others = base.filter((o) => o.cylinder !== c.cylinder).map((o) => o.dropRpm);
    const ref = others.length ? median(others) : c.dropRpm;
    const ratio = ref > 0 ? c.dropRpm / ref : 1;
    const status: CylinderStatus =
      inconclusive || others.length === 0 ? "ok" : ratio < WEAK_BAD ? "bad" : ratio < WEAK_WARN ? "warn" : "ok";
    return { ...c, status };
  });
  return { cylinders, inconclusive };
}
