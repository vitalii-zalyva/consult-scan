# 011 — Possible problems (diagnosis hints)

- **Status:** implemented (approved by user 2026-10-09; thresholds untuned on the car)
- **Prefix:** DX
- **Related:** 005 (ranges, RR-4xx findings are absorbed here), 006 (fault codes), 010 (fuel)

## Context
Individual out-of-range values are hard to interpret. This block combines live values, recent history and
fault codes into **possible problems** in plain language: what is wrong, the evidence, and what to check first.
These are heuristics from common Nissan VQ/Consult diagnostics, **not** a diagnosis; thresholds are unverified.

## Requirements

### Engine (DX-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| DX-101 | Rules run on: latest values, the full in-memory history, detected condition per sample, fault codes. Pure function `diagnose(ctx)`. | Unit tests per rule. |
| DX-102 | A rule may use the **most recent steady period** of a condition (≥ 8 s continuous in the last 2 min, last 10 s of it), so the user can do idle then 2000 rpm and both are evaluated. | `lastSteady` test. |
| DX-103 | Each problem has: id, title, severity (`bad`/`warn`), confidence (`likely`/`possible`), evidence lines with numbers, checks to do, related fault codes. | Type. |
| DX-104 | Problems sorted: severity, then confidence. | Test. |
| DX-105 | Coverage list: each rule reports `ok` / `problem` / `waiting` with what it needs (e.g. "warm idle 10 s"). | UI shows "N of M checks run". |
| DX-106 | Rules relying on unverified data (bit positions, ranges) MUST say so in their evidence. | Text. |

### Rules (DX-2xx) — thresholds are heuristics, unverified
| ID | Problem | Trigger | Confidence |
|---|---|---|---|
| DX-201 | Vacuum / intake air leak | Warm idle: A/F alpha avg > 115 % or self-learn > 112 %; *likely* if lean improves by ≥ 8 points at 2000 rpm | possible / likely |
| DX-202 | MAF under-reading or low fuel pressure | Lean (alpha > 115) at both idle and 2000 rpm; *likely MAF* if idle MAF < 1.0 V | possible / likely |
| DX-203 | Running rich (leaking injector, fuel pressure regulator, MAF over-reading) | Warm idle alpha < 85 % or self-learn < 88 %; MAF > 1.7 V points to MAF | possible |
| DX-204 | Bank imbalance | Warm closed loop: \|alpha B1 − alpha B2\| > 15 points | possible |
| DX-205 | Front O2 sensor slow | < 6 lean↔rich cycles in 10 s at warm 2000 rpm (`bad`) or idle (`warn`) | likely / possible |
| DX-206 | Front O2 stuck lean / rich | Warm 2000 rpm 10 s: max < 0.45 V (stuck lean / exhaust leak) or min > 0.45 V (stuck rich) | likely |
| DX-207 | Catalyst efficiency low | Warm 2000 rpm 10 s: rear O2 cycles ≥ 70 % of front cycles | possible |
| DX-208 | Thermostat stuck open | Engine running ≥ 10 min continuously and coolant still < 70 °C | likely |
| DX-209 | Overheating / cooling fan | Coolant > 105 °C `bad`, > 100 °C `warn`; fan bits both off above 100 °C adds "fan control" (bits unverified) | likely |
| DX-210 | Charging system | Running ≥ 5 s: battery avg < 13.0 V `bad`, < 13.2 V `warn`, > 15.0 V `bad` (overcharge); engine off < 12.2 V `warn` (weak battery) | likely |
| DX-211 | Idle air control | Warm idle, A/C off: AAC avg > 45 % (dirty throttle body / AAC valve) or < 15 % (air leak / throttle stop) | possible |
| DX-212 | Unstable idle | Warm idle 10 s: rpm std-dev > 40 rpm (misfire, vacuum leak, sticking AAC) | possible |
| DX-213 | Base ignition timing | Warm idle avg outside 13–17° BTDC | possible |
| DX-214 | Throttle position sensor | Closed throttle (idle) avg outside 0.35–0.65 V `warn`; jump > 1 V between samples at steady rpm `possible` worn TPS | possible |
| DX-215 | Idle (closed-throttle) switch | Warm idle, TPS < 0.65 V, closed-throttle bit off (bit position unverified) | possible |
| DX-216 | Sensor circuit at rail | Running: MAF < 0.3 V or > 4.9 V; coolant < −30 °C or > 140 °C; TPS < 0.1 V or > 4.9 V | likely |
| DX-217 | High idle fuel use | Warm idle derived fuel > 2.5 L/h (spec 010 defaults) | possible |
| DX-218 | Stored fault codes | Every DTC becomes a problem: present (0 starts) `bad` likely, past `warn` possible, with its hint | likely / possible |

### UI (DX-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| DX-301 | "Possible problems" card at the top of the engine view: problem title, severity colour, confidence, expandable evidence and checks. | Render test. |
| DX-302 | When nothing is found, say which checks ran and which still wait for a condition, so "no problems" is never overstated. | Render test. |
| DX-303 | Disclaimer: hints based on unverified thresholds, confirm with the FSM procedure. | Text. |

## Open questions
- [ ] Tune thresholds after the first real-car sessions (healthy baseline).
- [ ] Bit positions for DX-209/215 (see 008).

## Traceability
| ID | Code | Test |
|---|---|---|
| DX-1xx, 2xx | `src/analysis/diagnosis/` | `test/diagnosis.test.ts` |
| DX-3xx | `src/ui/components/DiagnosisPanel/` | `test/diagnosis.test.ts` |
