/**
 * Rough VQ30DE behaviour model for the simulator. Not physics; just plausible
 * values that move through the same operating states as a real car.
 * Spec: specs/003-ecu-simulator/spec.md (SIM-2xx)
 */
import type { ParamValues } from "@/protocol/registers";

import type { EngineState } from "./types";

export function createEngineState(coolant = 20): EngineState {
  return { t: 0, scenario: "idle", faults: new Set(), rpm: 0, coolant, speed: 0, learn: 100 };
}

const approach = (value: number, target: number, rate: number) => value + (target - value) * Math.min(1, rate);

/** Advances the model by dt seconds. `timeScale` speeds up warm-up for demos. */
export function stepEngine(s: EngineState, dt: number, timeScale = 20): void {
  s.t += dt;
  const running = s.scenario !== "off";
  const warm = s.coolant >= 70;
  const idleTarget = warm ? 700 : 700 + (70 - s.coolant) * 8;
  const rpmTarget = !running
    ? 0
    : s.scenario === "idle"
      ? idleTarget
      : s.scenario === "rev2000"
        ? 2000
        : 2400 + 300 * Math.sin(s.t / 3);
  s.rpm = approach(s.rpm, rpmTarget, dt * 3);
  s.speed = approach(s.speed, s.scenario === "drive" ? 70 + 10 * Math.sin(s.t / 5) : 0, dt * 0.8);

  const coolantTarget = s.faults.has("overheat") ? 118 : running ? 88 : 20;
  s.coolant = approach(s.coolant, coolantTarget, dt * timeScale * 0.002);

  const learnTarget = s.faults.has("vacuum-leak") ? 118 : 100;
  s.learn = approach(s.learn, learnTarget, dt * 0.05);
}

export function engineValues(s: EngineState): ParamValues {
  const running = s.rpm > 300;
  const warm = s.coolant >= 70;
  const load = s.scenario === "drive" ? 0.45 : s.scenario === "rev2000" ? 0.15 : 0.08;
  const noise = (amp: number) => (Math.random() - 0.5) * 2 * amp;
  const closedLoop = running && warm;

  const o2Hz = s.faults.has("o2-lazy") ? 0.08 : 1.2;
  const o2Phase = Math.sin(2 * Math.PI * o2Hz * s.t);
  const o2 = !running
    ? 0
    : closedLoop
      ? 0.45 + 0.4 * Math.sign(o2Phase) * Math.min(1, Math.abs(o2Phase) * 3)
      : 0.1 + noise(0.02);

  const leak = s.faults.has("vacuum-leak") ? 1 : 0;
  const alphaBase = closedLoop ? 100 + leak * 22 + 6 * o2Phase : 100;
  const maf = running
    ? 1.0 + (s.rpm / 1000) * 0.22 + load * 2.2 + (s.faults.has("maf-high") ? 0.9 : 0) - leak * 0.15
    : 0.3;
  const coldEnrich = warm ? 1 : 1 + (70 - s.coolant) / 120;
  const inj = running ? (2.0 + load * 4.5 + (s.rpm < 900 ? 0.75 : 0)) * coldEnrich : 0;
  // FU-501: air mass consistent with the injected fuel at stoichiometry (default fuel settings: 240 cc/min, 0.7 ms dead time).
  const fuelCcMin = running ? (Math.max(0, inj / coldEnrich - 0.7) * (s.rpm / 2) * 6 * 240) / 60_000 : 0;
  const airGs = (fuelCcMin / 60) * 0.745 * 14.7;

  const v: ParamValues = {
    rpm: s.rpm + (running ? noise(8) : 0),
    rpmRef: s.rpm,
    mafLh: maf + noise(0.02),
    coolant: s.coolant,
    o2Lh: Math.max(0, o2 + noise(0.02)),
    o2Rh: Math.max(
      0,
      (closedLoop ? 0.45 - 0.4 * Math.sign(o2Phase) * Math.min(1, Math.abs(o2Phase) * 3) : o2) + noise(0.02),
    ),
    speed: s.speed,
    battery: running ? (s.faults.has("weak-alternator") ? 12.3 : 14.1) + noise(0.08) : 12.5,
    tps: s.scenario === "drive" ? 1.4 + noise(0.1) : s.scenario === "rev2000" ? 0.86 : 0.48,
    iat: 25 + (s.coolant - 20) * 0.1,
    injLh: inj + noise(0.04),
    injRh: inj + noise(0.04),
    timing: !running ? 0 : s.rpm < 1000 ? 15 : Math.min(38, 15 + (s.rpm - 800) / 80),
    aac: !running ? 0 : warm ? 30 + leak * -12 + noise(1) : 45,
    afAlphaLh: alphaBase + noise(2),
    afAlphaRh: alphaBase + noise(2),
    afLearnLh: s.learn,
    afLearnRh: s.learn,
    // Bit positions per BIT_LABELS (PLMS): 0x13 bit0 closed throttle, bit2 P/N; 0x1E bit6 fuel pump relay.
    bits13: (s.scenario === "drive" ? 0 : 0b0000_0001) | (s.scenario === "drive" ? 0 : 0b0000_0100),
    bits1e: running ? 0b0100_0000 : 0,
    bits1f: 0,
    mrFcMnt: closedLoop ? (o2 < 0.45 ? 0b1000_0000 : 0) | (o2 > 0.45 ? 0b0100_0000 : 0) : 0,
    // XD-101 extras (OBD-era VQ30DE)
    purge: s.scenario === "drive" && warm ? 40 : 0,
    fuelGauge: 2.1,
    o2HeaterB1: running ? 1 : 0,
    o2HeaterB2: running ? 1 : 0,
    ignSwitch: 1,
    calLoad: running ? 14 + load * 60 : 0,
    baseFuel: running ? 1.2 + load * 2.5 : 0,
    rearO2B1: closedLoop ? 0.68 + noise(0.03) : 0.1,
    mafGs: airGs,
  };
  return v;
}

/** CU-2xx: A/T unit view of the same engine state. */
export function atValues(s: EngineState): ParamValues {
  const lever = s.scenario === "drive" ? 0x80 : 0x83;
  const gear = s.speed < 20 ? 1 : s.speed < 40 ? 2 : s.speed < 65 ? 3 : 4;
  return {
    "at.speedAt": s.speed,
    "at.speedMtr": s.speed,
    "at.tps": s.scenario === "drive" ? 1.4 : 0.48,
    "at.fluidTemp": 1.6 - Math.min(1, (s.coolant - 20) / 60) * 0.6, // voltage drops as fluid warms
    "at.battery": s.scenario === "off" ? 12.5 : 14.1,
    "at.rpm": s.rpm,
    "at.gear": s.scenario === "drive" ? gear : 1,
    "at.lever": lever,
    "at.vehicleSpeed": s.speed,
    "at.throttle": s.scenario === "drive" ? 22 : 0,
    "at.linePressure": s.scenario === "drive" ? 29 : 0,
    "at.tccDuty": s.scenario === "drive" && gear === 4 ? 94 : 4,
    "at.multi1": s.scenario === "drive" ? 0b0000_0001 : 0b0100_0001,
    "at.multi2": 0,
    "at.multi3": s.scenario === "drive" ? 0b0100_0000 : 0b1000_0000,
  };
}
