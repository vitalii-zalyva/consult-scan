/**
 * VQ30DE (Maxima A32, 1995-1999) Consult data-monitor reference values.
 * Spec: specs/005-reference-ranges/spec.md (RR-2xx)
 *
 * Source: Nissan FSM section EC, "CONSULT Reference Value in Data Monitor Mode"
 * and "Basic inspection" (idle speed / ignition timing). Values marked
 * `verified: false` were transcribed from secondary sources and MUST be checked
 * against the FSM for the exact market/year before being trusted.
 */
import type { ReferenceRule } from "./types";

export const VQ30DE_RULES: readonly ReferenceRule[] = [
  {
    param: "rpm",
    when: ["warm-idle"],
    range: { min: 575, max: 800 },
    note: "Idle 625±50 (M/T) / 700±50 (A/T, N)",
    verified: false,
  },

  {
    param: "mafLh",
    when: ["engine-off"],
    range: { min: 0.2, max: 0.5 },
    note: "Key ON, engine stopped: ~0.3–0.4 V",
    verified: false,
  },
  { param: "mafLh", when: ["warm-idle"], range: { min: 1.0, max: 1.7 }, note: "FSM: idle 1.0–1.7 V", verified: false },
  {
    param: "mafLh",
    when: ["warm-2000"],
    range: { min: 1.5, max: 2.1 },
    note: "FSM: 2000 rpm 1.5–2.1 V",
    verified: false,
  },

  { param: "coolant", when: [], range: { min: -40, max: 105 }, note: "Above ~105 °C = overheating", verified: false },
  {
    param: "coolant",
    when: ["warm-idle", "warm-2000", "warm-other"],
    range: { min: 70, max: 100 },
    note: "FSM: >70 °C after warm-up",
    verified: false,
  },

  {
    param: "battery",
    when: ["engine-off"],
    range: { min: 11.8, max: 13.0 },
    note: "Key ON, engine off: ~12.4–12.8 V",
    verified: false,
  },
  {
    param: "battery",
    when: ["cold", "warm-idle", "warm-2000", "warm-other", "driving"],
    range: { min: 13.2, max: 14.8 },
    note: "Charging; FSM lists 11–14 V",
    verified: false,
  },

  {
    param: "tps",
    when: ["engine-off", "warm-idle"],
    range: { min: 0.35, max: 0.65 },
    note: "Closed throttle 0.35–0.65 V",
    verified: false,
  },
  {
    param: "tps",
    when: [],
    range: { min: 0.2, max: 4.8 },
    note: "Sensor voltage must stay inside 0.2–4.8 V",
    verified: false,
  },

  { param: "injLh", when: ["warm-idle"], range: { min: 2.4, max: 3.2 }, note: "FSM: idle 2.4–3.2 ms", verified: false },
  { param: "injRh", when: ["warm-idle"], range: { min: 2.4, max: 3.2 }, note: "FSM: idle 2.4–3.2 ms", verified: false },
  {
    param: "injLh",
    when: ["warm-2000"],
    range: { min: 1.9, max: 2.8 },
    note: "FSM: 2000 rpm 1.9–2.8 ms",
    verified: false,
  },
  {
    param: "injRh",
    when: ["warm-2000"],
    range: { min: 1.9, max: 2.8 },
    note: "FSM: 2000 rpm 1.9–2.8 ms",
    verified: false,
  },

  {
    param: "timing",
    when: ["warm-idle"],
    range: { min: 13, max: 17 },
    note: "FSM: 15±2° BTDC at idle",
    verified: false,
  },
  {
    param: "timing",
    when: ["warm-2000"],
    range: { min: 25, max: 45 },
    note: "FSM: >25° BTDC at 2000 rpm",
    verified: false,
  },

  { param: "aac", when: ["warm-idle"], range: { min: 20, max: 40 }, note: "FSM: idle 20–40 %", verified: false },

  {
    param: "afAlphaLh",
    when: ["warm-idle", "warm-2000"],
    range: { min: 75, max: 125 },
    note: "FSM: 75–125 % (closed loop)",
    verified: false,
  },
  {
    param: "afAlphaRh",
    when: ["warm-idle", "warm-2000"],
    range: { min: 75, max: 125 },
    note: "FSM: 75–125 % (closed loop)",
    verified: false,
  },
  {
    param: "afLearnLh",
    when: [],
    range: { min: 80, max: 120 },
    note: "Learned trim far from 100 % = long-term lean/rich",
    verified: false,
  },
  {
    param: "afLearnRh",
    when: [],
    range: { min: 80, max: 120 },
    note: "Learned trim far from 100 % = long-term lean/rich",
    verified: false,
  },
  { param: "o2Lh", when: [], range: { min: 0, max: 1.1 }, note: "Sensor output 0–1 V", verified: false },
  {
    param: "rearO2B1",
    when: [],
    range: { min: 0, max: 1.1 },
    note: "Sensor output 0–1 V; steady ~0.5–0.8 V behind a good catalyst",
    verified: false,
  },

  // XD-101 OBD-era items (FSM wording from later VQ-engine manuals; check against the A32 FSM)
  {
    param: "baseFuel",
    when: ["warm-idle"],
    range: { min: 1.0, max: 1.6 },
    note: "B/FUEL SCHDL idle ~1.0–1.6 ms",
    verified: false,
  },
  {
    param: "calLoad",
    when: ["warm-idle"],
    range: { min: 14, max: 33 },
    note: "CAL/LD VALUE idle 14–33 %",
    verified: false,
  },
  {
    param: "calLoad",
    when: ["warm-2000"],
    range: { min: 12, max: 25 },
    note: "CAL/LD VALUE 2500 rpm 12–25 %",
    verified: false,
  },
  {
    param: "mafGs",
    when: ["warm-idle"],
    range: { min: 2, max: 6 },
    note: "MASS AIRFLOW idle 2.0–6.0 g/s",
    verified: false,
  },
  {
    param: "mafGs",
    when: ["warm-2000"],
    range: { min: 7, max: 20 },
    note: "MASS AIRFLOW 2500 rpm 7.0–20.0 g/s",
    verified: false,
  },
  { param: "o2Rh", when: [], range: { min: 0, max: 1.1 }, note: "Sensor output 0–1 V", verified: false },
];
