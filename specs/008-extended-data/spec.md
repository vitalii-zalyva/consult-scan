# 008 — Maximum data coverage

- **Status:** approved (user, 2026-10-09: "I need to check as much data from the ECU as possible")
- **Prefix:** XD
- **Related:** 001 (register map), 004 (display)

## Context
v0.1 streamed the ~26 best-known engine params. The PLMS *Generic Nissan ECU register table v2* lists more
registers (mostly 1996+ OBD-era ECUs, which includes the 1998 VQ30DE), and bit labels for the digital registers.
Unknown/undocumented registers may also exist on this ECU. Goal: read **everything the ECU answers**.

## Requirements

### Full known register map (XD-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| XD-101 | Add every register from the PLMS generic table not yet mapped (below). Scalings not given by PLMS are tentative and flagged `unverified`. | All addresses below present in `PARAMS`. |
| XD-102 | Every value row MUST also show the raw byte(s) in hex, so tentative scalings can be checked against the FSM later. | Raw column / tooltip in LiveTable. |

| Reg | Name (FSM) | Decode (tentative unless PLMS gives it) |
|---|---|---|
| 25 | PURG VOL C/V (step) | raw step |
| 26 | Tank fuel temp | b − 50 °C |
| 27 | FPCM DR voltage | b × 20 mV |
| 28 | Wastegate solenoid | b % |
| 29 | Turbo boost sensor | b × 20 mV |
| 2A | Engine mount | on/off (b ≠ 0) |
| 2E | Position counter | raw |
| 2F | Fuel gauge voltage | b × 20 mV |
| 30 / 31 | FR O2 heater B1 / B2 | on/off |
| 32 | Ignition switch | on/off |
| 33 | CAL/LD value | b % |
| 34 | B/FUEL SCHDL | b / 100 ms (FSM idle ref ≈1.0–1.6 ms fits) |
| 35 / 36 | RR O2 sensor B1 / B2 | b × 10 mV |
| 37 | Absolute throttle position | b × 20 mV |
| 38 | Mass air flow | b g/s |
| 39 | EVAP system pressure | b × 20 mV |
| 3A / 4A | Absolute pressure sensor | u16 × 20 mV? (raw shown) |
| 52 / 53 | FPCM F/P voltage | u16 × 5 mV? (raw shown) |

### Digital bit labels (XD-2xx) — PLMS table, column positions read from the PDF layout
| ID | Requirement | Acceptance criterion |
|---|---|---|
| XD-201 | Show labelled lamps for the bits below; unlabelled bits still shown as `bit N`. Labels marked unverified until checked on the car. | BitsPanel shows names. |

| Reg | Bit | Label |
|---|---|---|
| 13 | 4 / 3 / 2 / 1 / 0 | A/C switch / Power steering switch / Park-Neutral switch / Start signal / Closed throttle |
| 1E | 7 / 6 / 5 / 1 / 0 | A/C relay / Fuel pump relay / VTC solenoid / Fan high / Fan low |
| 1F | 6 / 5 / 3 / 0 | P/Reg control valve / Wastegate solenoid / IACV-FICD solenoid / EGR solenoid |
| 21 | 7 / 6 | Bank 1 lean / Bank 2 lean |

### Deep scan for undocumented registers (XD-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| XD-301 | A user-triggered "Deep scan" MUST probe every register address 0x00–0xFF (read-only `5A rr`) and record which answer. | Simulator with an extra undocumented register → found. |
| XD-302 | Supported addresses that are not in the map MUST be streamed and shown in an "Undocumented registers" panel as raw hex + decimal with a trend. | Panel lists them. |
| XD-303 | Deep scan results SHOULD persist per ECU part number in `localStorage`, so it runs once. | Reconnect skips scan. |
| XD-304 | The scan MUST be cancellable and show progress. | Progress `n/256`. |

## Out of scope (need their own approved spec)
- **Active tests** (`0A` commands: injector cut, timing shift, fuel pump, AAC, self-learn clear) — they change engine behaviour.
- **ROM/RAM read** (`C9 hi lo`) — read-only, but large (32 KB = 4096 requests), only useful for tuning/ECU identification.

## Open questions
- [ ] Which of the new registers does the A32 VQ30DE answer? → Deep scan on the car.
- [ ] Confirm tentative scalings against FSM ref. values (B/FUEL SCHDL, CAL/LD, rear O2).
- [ ] Confirm bit positions (toggle A/C, P/N, throttle, watch the lamps).

## Sources
- PLMS, *Generic Nissan Engine ECU Register Table Ver 2*: https://www.plmsdevelopments.com/images_ms/Generic_Nissan_ECU_Sensor_or_Data_register_table_Ver_2.pdf
- PLMS, *Consult Protocol & Commands Issue 6*: https://www.plmsdevelopments.com/images_ms/Consult_Protocol_&_Commands_Issue_6.pdf

## Traceability
| ID | Code | Test |
|---|---|---|
| XD-101..102 | `src/protocol/registers/`, `src/ui/components/LiveTable/` | `test/extended.test.ts` |
| XD-201 | `src/protocol/registers/ › BIT_LABELS`, `LiveTable.tsx › BitsPanel` | `test/extended.test.ts` |
| XD-301..304 | `src/protocol/session/ › deepScan`, `src/ui/App/` | `test/extended.test.ts` |
