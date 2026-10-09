// Spec: specs/004-live-dashboard/spec.md (LD-4xx)
import { m } from "./messages";

/** Number with a fixed number of decimals. */
export const fmt = (n: number, digits = 0) => n.toFixed(digits);

/** Display symbol for a unit (unknown units pass through, e.g. °C, %). */
export const unitLabel = (unit: string) => m.unit[unit] ?? unit;
