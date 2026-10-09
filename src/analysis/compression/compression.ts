/**
 * Manual compression test log: units, evaluation against spec, wet/dry hints.
 * Spec: specs/012-cylinder-health/spec.md (CY-5xx)
 */
import { ADJACENT_CYLINDERS, VQ30DE_COMPRESSION } from "./constants";
import type {
  CompressionEntry,
  CompressionEvaluation,
  CompressionHint,
  CompressionReason,
  CompressionSpec,
  CylinderCompression,
} from "./types";

/** CY-502 */
export function evaluateCompression(
  entry: CompressionEntry,
  spec: CompressionSpec = VQ30DE_COMPRESSION,
): CompressionEvaluation {
  const vals = entry.readingsKpa.filter((x): x is number => x !== null);
  const max = vals.length ? Math.max(...vals) : 0;
  const min = vals.length ? Math.min(...vals) : 0;
  const spreadKpa = max - min;
  const cylinders = entry.readingsKpa.map((kpa, i): CylinderCompression => {
    if (kpa === null) return { cylinder: i + 1, kpa, status: "na", reasons: [] };
    const reasons: CompressionReason[] = [];
    if (kpa < spec.minimumKpa) reasons.push("below-minimum");
    else if (kpa < spec.standardKpa * 0.9) reasons.push("below-standard");
    if (max - kpa > spec.maxDiffKpa) reasons.push("spread");
    const status =
      reasons.includes("below-minimum") || reasons.includes("spread") ? "bad" : reasons.length ? "warn" : "ok";
    return { cylinder: i + 1, kpa, status, reasons };
  });
  return { cylinders, spreadKpa };
}

/** CY-503: interpretation from dry (+ optional wet) results. */
export function compressionHints(dry: CompressionEvaluation, wet?: CompressionEvaluation): CompressionHint[] {
  const hints: CompressionHint[] = [];
  const low = (c: CylinderCompression) => c.status === "bad" || c.status === "warn";
  for (const [a, b] of ADJACENT_CYLINDERS) {
    const ca = dry.cylinders[a - 1];
    const cb = dry.cylinders[b - 1];
    if (ca && cb && low(ca) && low(cb)) hints.push({ kind: "head-gasket", cylinders: [a, b] });
  }
  if (wet) {
    for (const d of dry.cylinders) {
      if (!low(d) || d.kpa === null) continue;
      const w = wet.cylinders[d.cylinder - 1]?.kpa;
      if (w === null || w === undefined) continue;
      hints.push(w > d.kpa * 1.1 ? { kind: "rings", cylinder: d.cylinder } : { kind: "valves", cylinder: d.cylinder });
    }
  }
  return hints;
}

/** Latest dry entry and, if recorded the same day, the matching wet entry. */
export function latestPair(entries: readonly CompressionEntry[]): { dry?: CompressionEntry; wet?: CompressionEntry } {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const dry = sorted.find((e) => !e.wet);
  const wet = dry ? sorted.find((e) => e.wet && e.date.slice(0, 10) === dry.date.slice(0, 10)) : undefined;
  return { ...(dry ? { dry } : {}), ...(wet ? { wet } : {}) };
}
