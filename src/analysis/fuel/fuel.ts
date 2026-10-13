/**
 * Derived fuel consumption (no Consult register reports it directly).
 * Spec: specs/010-fuel-consumption/spec.md
 */
import type { ParamValues } from "@/protocol/registers";

import {
  DEFAULT_FUEL_SETTINGS,
  MAX_INTEGRATION_GAP_MS,
  MIN_CALIBRATION_LITRES,
  MIN_SPEED_FOR_DISTANCE,
} from "./constants";
import { FuelCalibrationError } from "./errors";
import type { FuelRate, FuelSettings, TripState } from "./types";

/** FU-103 */
export function deadTimeMs(batteryV: number | undefined, s: FuelSettings): number {
  const v = batteryV ?? 14;
  return Math.max(0, s.deadTime14Ms + s.deadTimeSlopeMsPerV * (14 - v));
}

/** FU-101..104, FU-106 (FU-105 withdrawn by RC-403: no g/s airflow on the A32 ECU). */
export function fuelRate(v: ParamValues, s: FuelSettings = DEFAULT_FUEL_SETTINGS): FuelRate {
  const rpm = v.rpm ?? 0;
  const pulses = [v.injLh, v.injRh].filter((x): x is number => x !== undefined);
  const pw = pulses.length ? pulses.reduce((a, b) => a + b, 0) / pulses.length : 0;
  const effective = Math.max(0, pw - deadTimeMs(v.battery, s));
  const ccPerMin = rpm > 0 ? (effective * (rpm / 2) * s.cylinders * s.injectorCcMin) / 60_000 : 0;
  const litresPerHour = ((ccPerMin * 60) / 1000) * s.calibration;

  const speed = v.speed ?? 0;
  const rate: FuelRate = { litresPerHour };
  if (speed > MIN_SPEED_FOR_DISTANCE) rate.litresPer100km = (litresPerHour / speed) * 100;
  return rate;
}

export const emptyTrip = (): TripState => ({ litres: 0, km: 0, durationMs: 0 });

/** FU-201: integrates one sample into the trip (mutates and returns it). */
export function addToTrip(trip: TripState, t: number, v: ParamValues, s: FuelSettings): TripState {
  if (trip.lastT !== undefined) {
    const dt = t - trip.lastT;
    if (dt > 0 && dt <= MAX_INTEGRATION_GAP_MS) {
      const hours = dt / 3_600_000;
      trip.litres += fuelRate(v, s).litresPerHour * hours;
      trip.km += (v.speed ?? 0) * hours;
      trip.durationMs += dt;
    }
  }
  trip.lastT = t;
  return trip;
}

export const tripAverage = (trip: TripState): number | undefined =>
  trip.km >= 0.1 ? (trip.litres / trip.km) * 100 : undefined;

/** FU-302: new calibration factor from a fill-up. */
export function calibrate(settings: FuelSettings, computedLitres: number, pumpedLitres: number): FuelSettings {
  if (computedLitres < MIN_CALIBRATION_LITRES) throw new FuelCalibrationError("too-short", computedLitres);
  if (!(pumpedLitres > 0)) throw new FuelCalibrationError("bad-input");
  return { ...settings, calibration: (settings.calibration * pumpedLitres) / computedLitres };
}
