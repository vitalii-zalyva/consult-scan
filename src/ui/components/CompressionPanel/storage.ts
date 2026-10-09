import type { PressureUnit } from "@/analysis/compression";
import { PRESSURE_UNITS } from "@/analysis/compression";

import { UNIT_KEY } from "./constants";

export const loadUnit = (): PressureUnit => {
  try {
    const u = localStorage.getItem(UNIT_KEY) as PressureUnit | null;
    return u && PRESSURE_UNITS.includes(u) ? u : "kPa";
  } catch {
    return "kPa";
  }
};
