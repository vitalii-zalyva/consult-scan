// Spec: specs/001-consult-protocol/spec.md (CP-4xx), specs/008-extended-data/spec.md (XD-1xx, XD-2xx)
import type { ParamDef } from "./types";

/** Display text for a value according to its kind. */
export function formatValue(p: ParamDef, v: number | undefined): string {
  if (v === undefined) return "—";
  switch (p.kind) {
    case "bits":
      return `0x${v.toString(16).padStart(2, "0")}`;
    case "onoff":
      return v ? "ON" : "OFF";
    case "enum":
      return p.enumLabels?.[v] ?? `0x${v.toString(16).padStart(2, "0")}`;
    default:
      return v.toFixed(p.digits);
  }
}

export const formatRaw = (bytes: readonly number[] | undefined) =>
  bytes ? bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ") : "";
