# 010 — Fuel consumption

- **Status:** implemented (approved by user 2026-10-09; injector flow unverified)
- **Prefix:** FU
- **Related:** 001 (registers 0x14/15, 0x22/23, 0x38, 0x0B, 0x0C), 004, 005

## Context
Consult-I has no fuel-flow register. Fuel flow is **derived** from injector pulse width (primary) and
cross-checked against mass air flow. Absolute accuracy depends on injector size and dead time, which are not in
the FSM, so the user can calibrate against real fill-ups.

## Requirements

### Instantaneous flow (FU-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| FU-101 | Injector-based flow: `cc/min = max(0, PW − deadTime(V)) × (rpm / 2) × cylinders × injectorCcMin / 60 000`, × calibration factor. VQ30DE: 6 cylinders, sequential (each injector fires once per 2 revs). | PW 3.1 ms, 700 rpm, 14 V, 240 cc/min, dead 0.7 ms → 20.2 cc/min = 1.21 L/h. |
| FU-102 | PW = mean of bank 1 and bank 2 pulse when both are available, else bank 1. | Unit test. |
| FU-103 | Dead time is battery-voltage corrected: `dead(V) = dead14 + slope × (14 − V)`, default `dead14 = 0.7 ms`, `slope = 0.15 ms/V`. | 12 V → 1.0 ms. |
| FU-104 | Fuel cut (PW ≤ dead time) and engine off give 0. | rpm 0 → 0 L/h. |
| FU-105 | MAF-based cross-check (only when register 0x38 is available, warm, closed loop): `L/h = g/s ÷ AFR(14.7) ÷ density(745 g/L) × 3600`. Show the difference to the injector value in %. | 3.69 g/s → 1.21 L/h. |
| FU-106 | Consumption per distance: `L/100 km = L/h ÷ km/h × 100`, shown only above 5 km/h; below that show L/h only. | 5.75 L/h at 70 km/h → 8.2 L/100 km. |

### Trip (FU-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| FU-201 | Integrate litres (injector method) and kilometres (vehicle speed) over time for every streamed sample; gaps longer than 2 s are not integrated. | 1 h at 6 L/h and 60 km/h → 6 L, 60 km. |
| FU-202 | Show trip litres, km, average L/100 km, and duration. "Reset trip" clears them. | UI. |
| FU-203 | The trip survives page reloads (persisted per browser). | Reload keeps totals. |

### Calibration (FU-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| FU-301 | Settings editable in the UI: injector flow (cc/min), dead time at 14 V, dead-time slope, calibration factor. Persisted per browser. | — |
| FU-302 | Fill-up calibration: after a fill-to-full, the user enters litres pumped; `factor_new = factor_old × pumped ÷ trip litres`. Trip then resets. Requires ≥ 5 L measured. | 10 L computed, 11 L pumped, factor 1.0 → 1.1. |
| FU-303 | Defaults are marked unverified: injector flow 240 cc/min is an estimate for the A32 VQ30DE, not from the FSM. | Label in settings. |

### Display (FU-4xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| FU-401 | Engine tab shows a Fuel card: instant L/h, L/100 km (when moving), MAF cross-check, trip block, Calibrate, Reset, Settings. | UI test. |
| FU-402 | Plausibility hint: warm idle outside 0.5–2.5 L/h shows "check injector settings". | — |

### Simulator (FU-5xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| FU-501 | Simulated MAF g/s MUST be consistent with simulated injector pulse at default settings (cross-check within ±10 % warm). | Test. |

## Out of scope
Fuel columns in the CSV (backlog), tank-level-based consumption (fuel level sensor 0x2F is too coarse), cold-start enrichment modelling.

## Open questions
- [ ] Actual injector flow for the A32 VQ30DE (part number on injector, or calibrate by fill-ups).
- [ ] Is Consult "INJ PULSE" total Ti (including battery-voltage correction Ts)? Assumed yes → dead time subtracted.
- [ ] Does the ECU answer 0x38 (g/s)? → deep scan on the car.

## Traceability
| ID | Code | Test |
|---|---|---|
| FU-1xx | `src/analysis/fuel/ › fuelRate` | `test/fuel.test.ts` |
| FU-2xx | `src/analysis/fuel/ › FuelTrip`, `src/ui/components/FuelPanel/` | `test/fuel.test.ts` |
| FU-3xx | `fuel.ts › calibrate`, `src/ui/components/FuelPanel/` | `test/fuel.test.ts` |
| FU-4xx | `src/ui/components/FuelPanel/` | `test/fuel.test.ts` (render) |
| FU-5xx | `src/simulator/engine-model/` | `test/fuel.test.ts` |
