/**
 * Persistence for power-balance results and compression entries (per browser), with CSV/JSON export.
 * Spec: specs/012-cylinder-health/spec.md (CY-306, CY-504, CY-505)
 */
import type { CompressionEntry, CompressionSpec } from "@/analysis/compression";
import { VQ30DE_COMPRESSION } from "@/analysis/compression";
import type { PowerBalanceResult } from "@/analysis/power-balance";

import { KEYS, MAX_HISTORY } from "./constants";
import { load, save } from "./storage";

export const cylinderStore = {
  powerBalance: (): PowerBalanceResult[] => load(KEYS.powerBalance, []),
  addPowerBalance(r: PowerBalanceResult): PowerBalanceResult[] {
    const all = [r, ...this.powerBalance()].slice(0, MAX_HISTORY);
    save(KEYS.powerBalance, all);
    if (!r.dryRun && !r.aborted && !r.restoreUnconfirmed) save(KEYS.fullRunDone, true);
    return all;
  },
  compression: (): CompressionEntry[] => load(KEYS.compression, []),
  addCompression(e: CompressionEntry): CompressionEntry[] {
    const all = [e, ...this.compression()].slice(0, MAX_HISTORY);
    save(KEYS.compression, all);
    return all;
  },
  removeCompression(id: string): CompressionEntry[] {
    const all = this.compression().filter((e) => e.id !== id);
    save(KEYS.compression, all);
    return all;
  },
  spec: (): CompressionSpec => ({ ...VQ30DE_COMPRESSION, ...load<Partial<CompressionSpec>>(KEYS.spec, {}) }),
  setSpec: (s: CompressionSpec) => save(KEYS.spec, s),
  /** CY-207: dry run stays the default until one full run completed. */
  fullRunDone: (): boolean => load(KEYS.fullRunDone, false),
};

export function powerBalanceCsv(results: readonly PowerBalanceResult[]): string {
  const rows = [
    [
      "date",
      "odometer_km",
      "dry_run",
      "mode",
      "aborted",
      "restore_unconfirmed",
      "cylinder",
      "drop_rpm",
      "drop_pct",
      "min_rpm",
      "status",
    ],
  ];
  for (const r of results)
    for (const c of r.cylinders)
      rows.push([
        r.date,
        String(r.odometerKm ?? ""),
        String(r.dryRun),
        r.mode,
        r.aborted ?? "",
        String(r.restoreUnconfirmed),
        String(c.cylinder),
        c.dropRpm.toFixed(0),
        c.dropPct.toFixed(1),
        c.minRpm.toFixed(0),
        c.status,
      ]);
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}

export function compressionCsv(entries: readonly CompressionEntry[]): string {
  const rows = [
    [
      "date",
      "odometer_km",
      "warm",
      "wet",
      "cyl1_kpa",
      "cyl2_kpa",
      "cyl3_kpa",
      "cyl4_kpa",
      "cyl5_kpa",
      "cyl6_kpa",
      "cranking_rpm",
      "notes",
    ],
  ];
  for (const e of entries)
    rows.push([
      e.date,
      String(e.odometerKm ?? ""),
      String(e.warm),
      String(e.wet),
      ...e.readingsKpa.map((k) => (k === null ? "" : k.toFixed(0))),
      String(e.crankingRpm ?? ""),
      JSON.stringify(e.notes ?? ""),
    ]);
  return rows.map((r) => r.join(",")).join("\n") + "\n";
}
