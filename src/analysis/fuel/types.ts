// Spec: specs/010-fuel-consumption/spec.md

export interface FuelSettings {
  /** Static injector flow, cc/min. FU-303: 240 is an estimate for the A32 VQ30DE. */
  injectorCcMin: number;
  /** Injector opening delay at 14 V, ms. */
  deadTime14Ms: number;
  /** Extra dead time per volt below 14 V, ms/V. */
  deadTimeSlopeMsPerV: number;
  /** Multiplier learned from fill-ups (FU-302). */
  calibration: number;
  cylinders: number;
}

export interface FuelRate {
  /** Injector-based flow, L/h (calibrated). */
  litresPerHour: number;
  /** L/100 km when moving, else undefined. */
  litresPer100km?: number;
  /** FU-105: MAF-based flow, L/h, when register 0x38 is available. */
  mafLitresPerHour?: number;
}

export interface TripState {
  litres: number;
  km: number;
  durationMs: number;
  lastT?: number;
}
