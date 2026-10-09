# 012 — Cylinder health: power balance test + compression log

- **Status:** implemented (approved by user 2026-10-09; automatic transmission) — not yet run on the car
- **Prefix:** CY
- **Related:** 001 (protocol), 011 (diagnosis)

## Context
Consult-I has no cylinder-pressure data. Two complementary tools:

1. **Power balance test** (electronic, *active test*): at warm idle the ECU stops firing one cylinder at a
   time (`0A 88 <mask>`); the rpm drop shows how much that cylinder contributes. Finds **which** cylinder is weak
   (compression, ignition or injection).
2. **Compression log** (manual): the user measures compression with a gauge, enters the readings; the app
   checks them against the VQ30DE spec and keeps history. Confirms **why** (mechanical).

## Part A — Power balance test (CY-1xx … CY-4xx)

### Protocol (CY-1xx)
Source: PLMS *Consult Protocol & Commands Issue 6* §4.1.6, *Generic register table v2* (register 0x88).

| ID | Requirement | Acceptance criterion |
|---|---|---|
| CY-101 | Cut cylinder *n* (1–6): `0A 88 <1 << (n−1)>` + `F0`; ECU echo `F5 88 <mask>`. Only **one** bit may be set — never cut two cylinders. | Unit test rejects masks with ≠ 1 bit. |
| CY-102 | Restore: `0A 88 00` + `F0`, then `30` → `CF`. Sent after every cut, on every error, cancel, disconnect and page unload. | Simulator: restore on each exit path. |
| CY-103 | rpm (`5A 00 5A 01`) is streamed during the test. Preferred: one combined request `0A 88 <mask> 5A 00 5A 01 F0`. Fallback if the ECU rejects the combination: cut, then stream rpm as a separate request. Which one works is decided by the car session (open question). | Both paths implemented and simulator-tested. |
| CY-105 | Waiting for the stop acknowledgement (`CF`) after `30` is bounded (32 reads); an ECU that keeps streaming makes the call fail instead of hanging, so restore still runs. | Simulator "ignores STOP" test. |
| CY-104 | Only the power-balance register `0x88` with data `00` or a single-bit mask is ever sent with `0A`. Any other active-test register is a programming error (throws before writing). | Unit test. |

### Safety interlocks (CY-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CY-201 | **Start conditions** (all required): engine ECU selected; coolant ≥ 70 °C; rpm 550–1000 (warm idle); vehicle speed 0; no other operation running. If the P/N bit (0x13 bit 2, unverified) is available and off, show a warning but allow. | Each condition blocks Start with a reason. |
| CY-202 | **Explicit confirmation** dialog before every run: what will happen, "transmission in P/N, parking brake on, nobody near the engine bay, do not drive". | Dialog text. |
| CY-203 | **Cut duration** max 4 s per cylinder; **pause** ≥ 5 s with all cylinders firing between cuts; whole test ≤ 2 rounds. | Timer test in simulator. |
| CY-204 | **Abort immediately** (restore first, then report) if: rpm < 450 (stall risk); speed > 0; coolant > 105 °C; frame timeout; user presses Stop; tab hidden/closing; transport error. | Simulator fault-injection tests per trigger. |
| CY-205 | **Restore verification:** after restore, the mean rpm over the last second of a 5 s window must be back within `clamp(30 % of the measured cut drop, 25, 100)` rpm of the baseline (a fixed 100 rpm would miss a cut left active, because idle control recovers part of the drop). If not, or if the restore command could not be confirmed, show a blocking warning: "Switch the ignition OFF for 10 s and back ON — this resets all ECU tests." | Simulator: missing CF → warning shown. |
| CY-206 | The test is never started automatically and never runs while streaming pages from other units. | Code path. |
| CY-208 | Start conditions are **re-checked inside the runner** on fresh baseline data before every cut (the UI state can be stale); failure aborts with `interlock` before any cut is sent. Speed must be known (unknown ≠ stationary). | Simulator: engine cooled after UI check → no cut sent. |
| CY-209 | Every cut is followed by restore **and** the CY-205 recovery window, also when the cut was aborted or failed; Stop cannot shorten the recovery window. Disconnect and unit switch stop a running test (restore first) instead of waiting for it. Timing limits are clamped inside the runner. | Simulator tests: Stop + ignored restore, disconnect mid-cut, clamp. |
| CY-207 | A **dry-run mode** (first use): cut cylinder 1 only for 2 s, with the traffic log recording, so the protocol behaviour (CY-103) can be confirmed before a full run. | UI option, default ON until a full run succeeded once. |

### Measurement (CY-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CY-301 | Baseline = mean rpm over 3 s before each cut. | — |
| CY-302 | Drop = baseline − mean rpm over the **first 2 s** of the cut (before idle speed control compensates); also record the minimum. | Simulator with known drops. |
| CY-303 | Record IACV-AAC % before/during the cut (shows idle-control compensation). | Shown in details. |
| CY-304 | Per cylinder: drop in rpm and %, averaged over rounds. | Table + bar chart. |
| CY-305 | **Weak cylinder:** drop < 50 % of the median drop of the others → `bad`; < 70 % → `warn`. All drops < 40 rpm → "test inconclusive (idle control too strong / misfire elsewhere)". | Unit tests. |
| CY-306 | Results saved with date, odometer (optional user input), ECU part number; history list, export CSV. | Persisted per browser. |

### UI (CY-4xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CY-401 | "Cylinder health" card on the engine tab: Start/Stop, live state (baseline / cutting cyl N / pause), live rpm, per-cylinder bars. | Render test. |
| CY-402 | Interlock reasons shown when Start is disabled. | Render test. |
| CY-403 | Results interpretation text: weak cylinder → next steps (plug, coil swap test, injector, then compression test). | Text present. |

## Part B — Compression log (CY-5xx)

| ID | Requirement | Acceptance criterion |
|---|---|---|
| CY-501 | Entry form: date, odometer, engine warm/cold, dry or wet (oil added), 6 readings, unit kPa / bar / psi / kgf/cm², cranking rpm (optional), notes. Stored in kPa. | Unit conversion tests. |
| CY-502 | Evaluate against VQ30DE spec (**unverified**, from FSM EM section as recalled): standard **1 275 kPa** (13.0 kgf/cm², 185 psi), minimum **981 kPa** (10.0 kgf/cm², 142 psi), max difference between cylinders **98 kPa** (1.0 kgf/cm², 14 psi), at ~300 rpm cranking. Per cylinder `ok` / `warn` (< standard − 10 %) / `bad` (< minimum or diff > limit). | Unit tests. |
| CY-503 | Wet vs dry: if a wet reading rises > 10 % above dry for the same cylinder → hint "piston rings / bore"; if it stays low → "valves / head gasket". Two adjacent low cylinders → "head gasket between them". | Unit tests. |
| CY-504 | History table, trend per cylinder, CSV export/import (JSON backup). | — |
| CY-505 | Spec values editable in settings (user can enter values from their own FSM). | — |

## Part C — Diagnosis integration (CY-6xx)
| ID | Requirement |
|---|---|
| CY-601 | Latest power-balance weak cylinder and compression `bad` results appear in "Possible problems" (new rule DX-219), with the date of the measurement. |
| CY-602 | If power balance and compression agree on the same cylinder → `likely`; only one of them → `possible`. |

## Safety
- **Why this is acceptable:** power balance is a standard Nissan CONSULT dealer test, performed at warm idle,
  stationary. PLMS documents it as cutting fuel *and* ignition (no raw fuel into the catalyst).
- **Risks:** stall at idle (mitigated by CY-204 rpm floor and short cuts); ECU left with a cylinder disabled if
  communication breaks mid-test (mitigated by CY-102 restore on every path, CY-205 verification and the
  ignition-cycle instruction — the ECU clears active tests on power-up); confusing the car's idle control
  (results only, no lasting effect).
- **Never:** while driving; with more than one cylinder cut; with any active-test register other than 0x88;
  automatically or in the background.
- CLAUDE.md safety rules will be updated to allow exactly `0A 88 <single bit | 00>` under this spec.

## Simulator (CY-7xx)
| ID | Requirement |
|---|---|
| CY-701 | Fake ECU accepts `0A 88 mask`, echoes `F5 88 mask`, applies the cut to the engine model (rpm drop ≈ 60–90 rpm, idle control recovers ~50 % over 3 s). |
| CY-702 | Injectable faults: weak cylinder N (smaller drop), "ECU ignores restore" (for CY-205), "stall on cut". |
| CY-703 | Manual compression entries are independent of the simulator. |

## Open questions
- [ ] Does the A32 ECU accept the combined `0A 88 … 5A 00 5A 01 F0` request (CY-103)? → dry run on the car.
- [ ] Echo format of `0A`: assumed `F5` (inverted) followed by register and data unchanged. → dry run traffic log.
- [ ] Does the cut persist after `30` (stop) or only while streaming? Design restores explicitly either way.
- [ ] Exact VQ30DE compression spec from the user's FSM (EM section) — CY-502 values are from memory.
- [x] M/T or A/T → **A/T** (user): P/N check uses 0x13 bit 2 (position unverified), warning only.

## Traceability
| ID | Code | Test |
|---|---|---|
| CY-101..104 | `src/protocol/consult/ › powerBalanceStream, setPowerBalance, assertPowerBalanceMask, cylinderMask` | `test/powerBalance.test.ts` "CY-101/104", "CY-103" |
| CY-105 | `consult.ts › readStream` (MAX_TRAILING_BYTES_AFTER_STOP) | "blocker: ECU that ignores STOP…" |
| CY-201..209 | `src/analysis/power-balance/ › checkInterlocks, abortReason, hasRecovered`; `src/protocol/power-balance-runner/`; `session.ts › cancelProcedure`; `src/ui/components/PowerBalancePanel/` | `test/powerBalance.test.ts` "CY-201", "CY-2xx: aborts always restore", "CY-207", "Safety review fixes" |
| CY-301..306 | `powerBalance.ts › analyzeCuts`; `src/logging/cylinder-store/` | "CY-305", "CY-1xx/3xx: full run", "CY-306/504" |
| CY-401..403 | `src/ui/components/PowerBalancePanel/` | `test/cylinder.test.tsx` "CY-401/402" |
| CY-501..505 | `src/analysis/compression/`; `src/ui/components/CompressionPanel/`; `src/logging/cylinder-store/` | `test/cylinder.test.tsx` "CY-501", "CY-502", "CY-503", "CY-5xx" |
| CY-601..602 | `src/analysis/diagnosis/ › DX-219`; `diagnosisText.ts › cylinder` | `test/cylinder.test.tsx` "CY-6xx" |
| CY-701..703 | `src/simulator/fake-ecu/`, `engineModel.ts › cutDrop`; `src/ui/components/SimulatorPanel/` | `test/powerBalance.test.ts` (all simulator runs) |
