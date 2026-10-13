export {
  DEFAULT_FUEL_SETTINGS,
  MAX_INTEGRATION_GAP_MS,
  MIN_CALIBRATION_LITRES,
  MIN_SPEED_FOR_DISTANCE,
} from "./constants";
export { FuelCalibrationError } from "./errors";
export { addToTrip, calibrate, deadTimeMs, emptyTrip, fuelRate, tripAverage } from "./fuel";
export type { FuelRate, FuelSettings, TripState } from "./types";
