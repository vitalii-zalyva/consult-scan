/**
 * Turns structured progress events and known errors into UI text (LD-402).
 */
import { FuelCalibrationError, MIN_CALIBRATION_LITRES } from "@/analysis/fuel";
import { ConsultError } from "@/protocol/consult";
import type { Progress } from "@/protocol/session";
import type { UnitId } from "@/protocol/units";

import { fmt } from "./format";
import { m } from "./messages";

const unitName = (u: UnitId) => m.units[u];

export function describeProgress(p: Progress): string {
  switch (p.kind) {
    case "init":
      return m.progress.init;
    case "part-number":
      return m.progress.partNumber;
    case "detect":
      return m.progress.detect(unitName(p.unit), p.i, p.n);
    case "looking-for-unit":
      return m.progress.lookingForUnit(unitName(p.unit));
    case "units-found":
      return m.progress.unitsFound(p.units.map((u) => unitName(u)).join(", "));
    case "deep-scan":
      return m.progress.deepScan(p.i, p.found);
    case "deep-scan-cancelled":
      return m.progress.deepScanCancelled;
    case "deep-scan-done":
      return m.progress.deepScanDone(p.found);
  }
}

/** Known errors get a friendly message; anything else is shown verbatim. */
export function describeError(err: unknown): string {
  if (err instanceof ConsultError) {
    if (err.code === "init-failed") return m.errors.initFailed;
    if (err.code === "unit-init-failed") return m.errors.unitInitFailed(err.detail ?? "?");
    if (err.code === "clear-not-allowed") return m.errors.clearNotAllowed;
  }
  if (err instanceof FuelCalibrationError) {
    return err.code === "too-short"
      ? m.errors.calibrateTooShort(MIN_CALIBRATION_LITRES, fmt(err.have, 1))
      : m.errors.calibrateBadInput;
  }
  return err instanceof Error ? err.message : String(err);
}
