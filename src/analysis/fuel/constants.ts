// Spec: specs/010-fuel-consumption/spec.md
import type { FuelSettings } from "./types";

export const DEFAULT_FUEL_SETTINGS: FuelSettings = {
  injectorCcMin: 240,
  deadTime14Ms: 0.7,
  deadTimeSlopeMsPerV: 0.15,
  calibration: 1,
  cylinders: 6,
};

export const STOICH_AFR = 14.7;
export const FUEL_DENSITY_G_PER_L = 745;
/** FU-106: below this speed L/100 km is meaningless. */
export const MIN_SPEED_FOR_DISTANCE = 5;
/** FU-201: longer gaps between samples are not integrated. */
export const MAX_INTEGRATION_GAP_MS = 2000;

/** FU-302: minimum computed litres for a meaningful fill-up calibration. */
export const MIN_CALIBRATION_LITRES = 5;
