// Spec: specs/012-cylinder-health/spec.md (CY-5xx)
import type { CompressionSpec, PressureUnit } from "./types";

export const PRESSURE_UNITS: readonly PressureUnit[] = ["kPa", "bar", "psi", "kgf/cm2"];

export const KPA_PER: Record<PressureUnit, number> = { kPa: 1, bar: 100, psi: 6.894757, "kgf/cm2": 98.0665 };
export const UNIT_DIGITS: Record<PressureUnit, number> = { kPa: 0, bar: 2, psi: 0, "kgf/cm2": 1 };

/** CY-502: VQ30DE values recalled from the FSM EM section — unverified, user-editable (CY-505). */
export const VQ30DE_COMPRESSION: CompressionSpec = { standardKpa: 1275, minimumKpa: 981, maxDiffKpa: 98 };

/** VQ30DE: cylinders 1-3-5 on one bank, 2-4-6 on the other; neighbours share a head-gasket bridge. */
export const ADJACENT_CYLINDERS: readonly [number, number][] = [
  [1, 3],
  [3, 5],
  [2, 4],
  [4, 6],
];
