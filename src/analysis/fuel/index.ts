export {
  DEFAULT_FUEL_SETTINGS,
  FUEL_DENSITY_G_PER_L,
  MAX_INTEGRATION_GAP_MS,
  MIN_CALIBRATION_LITRES,
  MIN_SPEED_FOR_DISTANCE,
  STOICH_AFR,
} from "./constants";
export { FuelCalibrationError } from "./errors";
export { addToTrip, calibrate, deadTimeMs, emptyTrip, fuelRate, tripAverage } from "./fuel";
export type { FuelRate, FuelSettings, TripState } from "./types";
