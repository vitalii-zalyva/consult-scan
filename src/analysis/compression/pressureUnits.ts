// Spec: specs/012-cylinder-health/spec.md (CY-5xx)
import { KPA_PER } from "./constants";
import type { PressureUnit } from "./types";

export const toKpa = (value: number, unit: PressureUnit) => value * KPA_PER[unit];
export const fromKpa = (kpa: number, unit: PressureUnit) => kpa / KPA_PER[unit];
