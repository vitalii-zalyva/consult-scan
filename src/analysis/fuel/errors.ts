// Spec: specs/010-fuel-consumption/spec.md
import { MIN_CALIBRATION_LITRES } from "./constants";

/** LD-402: calibration errors carry a code the UI turns into a message. */
export class FuelCalibrationError extends Error {
  constructor(
    readonly code: "too-short" | "bad-input",
    readonly have = 0,
  ) {
    super(
      code === "too-short"
        ? `Need at least ${MIN_CALIBRATION_LITRES} L on the trip to calibrate (have ${have.toFixed(1)} L).`
        : "Enter the litres pumped at the fill-up.",
    );
    this.name = "FuelCalibrationError";
  }
}
