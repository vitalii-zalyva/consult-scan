/**
 * Data-log recorder and CSV export.
 * Spec: specs/007-data-logging/spec.md
 */
import type { Sample } from "@/analysis/evaluate";
import type { ParamDef } from "@/protocol/registers";

export function toCsv(params: readonly ParamDef[], samples: readonly Sample[]): string {
  const header = ["time_s", ...params.map((p) => `${p.id} [${p.unit}]`)];
  const t0 = samples[0]?.t ?? 0;
  const rows = samples.map((s) => [
    ((s.t - t0) / 1000).toFixed(3),
    ...params.map((p) => {
      const v = s.values[p.id];
      return v === undefined ? "" : v.toFixed(p.digits);
    }),
  ]);
  return [header, ...rows].map((r) => r.join(",")).join("\n") + "\n";
}
