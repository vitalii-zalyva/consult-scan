# 009 — Other control units (A/T, climate)

- **Status:** approved (user, 2026-10-09: maximum data)
- **Prefix:** CU
- **Related:** 001, 008

## Context
On Consult-I the **third init byte selects the control unit**: `FF FF EF` engine, `FF FF EA` automatic
transmission, `FF FF DF` auto air-con, `FF FF E4` HICAS (PLMS). The A32 Maxima has an electronically controlled
4-speed automatic (if A/T) and on some trims automatic climate control. ABS and airbag units may also be on
the connector, but their select bytes are not documented.

## Requirements

### Unit selection (CU-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CU-101 | `ConsultClient.init(unit)` MUST send `FF FF <unitByte>`; default engine `EF`. | Simulator answers `EA` with `10`. |
| CU-102 | "Scan control units" MUST try the known bytes (EF, EA, DF, E4) and report which answer `10`; the session re-selects the engine afterwards. | Simulator with engine + A/T → both found. |
| CU-103 | Fault codes (`D1`) MUST be readable per unit; descriptions for non-engine units show the raw number until a table is sourced. | A/T codes listed separately. |
| CU-104 | Clearing codes on non-engine units is out of scope for now (read-only). | No clear button on those tabs. |

### A/T unit registers (CU-2xx) — PLMS "A/T ECU Sensor Register Table"
| Reg | Name | Decode |
|---|---|---|
| 00 | VHCL/S SE-A/T | b km/h |
| 01 | VHCL/S SE-MTR | b km/h |
| 02 | THRTL POS SEN | b / 50 V |
| 03 | FLUID TEMP SEN | b / 50 V |
| 04 | BATTERY VOLT | b × 8 / 100 V |
| 06 | ENGINE SPEED | b × 32 rpm |
| 08 / 09 / 0A | MULTI 1/2/3 | bits (below) |
| 0C | GEAR | b + 1 |
| 0D | SELECT LVR POS | 83 N-P, 82 1, 81 2, 80 D, 87 R |
| 0E | VEHICLE SPEED | b km/h |
| 0F | THROTTLE POSI | b / 2.55 % |
| 10 | LINE PRESS DUTY | b × 64 / 100 % |
| 11 | TCC S/V DUTY | b % |

| ID | Requirement | Acceptance criterion |
|---|---|---|
| CU-201 | Stream all A/T registers the unit supports (probe like CP-501) in a "Transmission" tab. | Simulator A/T values shown. |
| CU-202 | A/T bit registers shown with labels: 08 = kickdown, closed throttle, power shift, WOT, ASCD OD cut, ASCD cruise, R position, OD switch (bit 7→0); 09 = hold sw, overrun clutch S/V, shift S/V B, shift S/V A (bit positions unverified); 0A = P/N, D, 2, 1 position switches (positions unverified). | Lamps labelled. |
| CU-203 | Reference checks: fluid temp sensor voltage and line pressure have no sourced ranges → `na` (no colouring) until sourced. | — |

### Climate unit (CU-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CU-301 | If `DF` answers, stream the PLMS climate registers (word values / 16 °C: ambient 20, in-car 21/22, ducts 23–25, coolant 27, set temp 42, blower 2F, compressor 41). | Shown in a "Climate" tab when present. |

## Safety
Only init, `5A`, `D1`, `F0`, `30` are sent to non-engine units. Active tests (`0A`) remain out of scope.

## Open questions
- [ ] Does the A32 TCU answer `EA` on the 14-pin connector? → car session, Scan control units.
- [ ] ABS / airbag select bytes — unknown; a wider select-byte scan (E0–EF, D0–DF) is possible but not yet approved.
- [ ] A/T and climate DTC numbering/descriptions → FSM AT / HA sections.

## Traceability
| ID | Code | Test |
|---|---|---|
| CU-101..104 | `src/protocol/consult/ › init(unit)`, `src/protocol/units/`, `session.ts › scanUnits` | `test/extended.test.ts` |
| CU-201..203 | `src/protocol/units/ › AT_PARAMS` | `test/extended.test.ts` |
| CU-301 | `units.ts › CLIMATE_PARAMS` | `test/extended.test.ts` |
