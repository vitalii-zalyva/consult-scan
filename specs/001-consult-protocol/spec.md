# 001 — Consult-I protocol client

- **Status:** implemented (replay of a real ECU log passes; not yet run against the A32 ECU)
- **Prefix:** CP
- **Related:** 002-transports, 003-ecu-simulator, docs/consult-protocol.md

## Context
`ConsultClient` speaks Consult-I over any `Transport`. It must handle a real ECU's timing quirks and tolerate
leftover state from a previous session.

## Requirements

### Init (CP-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CP-101 | MUST send `FF FF EF` and treat `10` as connected. | Replay of `test/fixtures/openconsult-log_01.txt` connects. |
| CP-102 | MUST retry init (default 3 × 1.5 s) and then fail with an actionable message (ignition, socket, port). | Silent transport → `ConsultError` mentioning ignition. |
| CP-103 | MUST verify the echo of each command: command bytes bit-inverted, data bytes unchanged. | `5A 00 5A 0C` → expects `A5 00 A5 0C`; `D1` → `2E`. |
| CP-104 | SHOULD send `30` and discard input before init, in case the ECU is still streaming. | Init after an aborted stream succeeds (simulator). |

### ECU identification (CP-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CP-201 | MUST read the part number with `D0` → `2F`, `F0`, frame, `30` → `CF`. | Replay log returns a part number. |
| CP-202 | MUST format the 22-byte frame as `23710-<ASCII bytes 17–21> (ROM <bytes 2–3 hex>)`; non-printable → `unknown (<hex>)`. | Log frame → `23710-AA502 (ROM 1480)`. |

### Fault codes (CP-3xx) — semantics in 006
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CP-301 | MUST read codes with `D1`; frame = pairs `[code, startsSince]`. | Log frame `33 0B` → code 51, 11 starts. |
| CP-302 | MUST clear codes with `C1`, `F0`, then stop. | Simulator: read after clear returns no codes. |

### Live data (CP-4xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CP-401 | MUST request registers as `5A rr` pairs in one write, then `F0`. | Replay log stream matches byte-for-byte. |
| CP-402 | MUST parse frames `FF <len> <data>`, resynchronising on `FF` if garbage arrives. | Frames with leading noise are decoded. |
| CP-403 | MUST stop with `30` and consume frames in flight until `CF`. | Replay: trailing `ff04…b5cf` consumed, log finished. |
| CP-404 | MUST decode values using the register map below. | Log frame `00 75 00 B4` → 1462.5 rpm, 0 km/h, 14.4 V. |
| CP-405 | MUST NOT put more than 20 register bytes in one stream (see LD-102). | `pageParams` test. |

### Capability detection (CP-5xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| CP-501 | MUST probe each known register once per connection; `FE` = unsupported; the ECU must remain usable afterwards. | Simulator: `0x29` → false, next probe → true. |
| CP-502 | If no register probes as supported, SHOULD fall back to the `verified` register set. | Code path in `session.detect`. |
| CP-503 | A probe that gets no frame (timeout) MUST count as unsupported: register `0xFE` echoes as `FE`, indistinguishable from the invalid reply. | Deep scan over 0x00–0xFF completes in the simulator. |

## Register map (from OpenConsult / PLMS; ✔ = confirmed in a real log or widely documented)

Extended registers 0x25–0x53 and bit labels: see 008-extended-data.

| Reg | Param | Decode | Unit | Confidence |
|---|---|---|---|---|
| 00/01 | Engine speed (POS) | u16 × 12.5 | rpm | ✔ real log |
| 02/03 | Engine speed (REF) | u16 × 8 | rpm | unverified |
| 04/05 | MAF voltage | u16 × 5 mV | V | ✔ |
| 06/07 | MAF voltage RH | u16 × 5 mV | V | not on VQ30DE (single MAF) |
| 08 | Coolant temp | b − 50 | °C | ✔ |
| 09 / 0A | Front O2 bank 1 / 2 | b × 10 mV | V | ✔ / unverified |
| 0B | Vehicle speed | b × 2 | km/h | ✔ real log |
| 0C | Battery | b × 80 mV | V | ✔ real log |
| 0D | TPS | b × 20 mV | V | ✔ |
| 0F | Fuel temp | b − 50 | °C | unverified |
| 11 | Intake air temp | b − 50 | °C | unverified |
| 12 | EGT / EGR temp sensor | b × 20 mV | V | unverified |
| 13 | Digital inputs | bits | — | unverified, labels unknown |
| 14/15 | Injection pulse bank 1 | u16 / 100 | ms | ✔ |
| 16 | Ignition timing | 110 − b | ° BTDC | ✔ |
| 17 | IACV-AAC | b / 2 | % | ✔ |
| 1A / 1B | A/F alpha bank 1 / 2 | b | % | ✔ / unverified |
| 1C / 1D | A/F alpha self-learn | b | % | unverified |
| 1E / 1F | Digital outputs | bits | — | unverified, labels unknown |
| 21 | M/R F/C MNT (O2 monitor) | raw | — | unverified |
| 22/23 | Injection pulse bank 2 | u16 / 100 | ms | unverified |
| 25 | Purge control valve | raw | — | unverified |

## Out of scope
Active tests (`0A`-family commands), ROM reads, Consult-II.

## Open questions
- [ ] Which registers does the A32 VQ30DE ECU actually support? → first car session (CP-501 output + traffic log).
- [ ] REF rpm scale (× 8?) → compare with POS rpm on the car.
- [ ] Bank 2 injection at 22/23 or elsewhere on this ECU? → car session.
- [ ] Real frame rate at 9600 baud for 20 registers → traffic log timestamps (add timestamps if needed).

## Traceability
| ID | Code | Test |
|---|---|---|
| CP-101..104 | `src/protocol/consult/ › init` | `test/consult.test.ts` replay, "CP-102"; `test/robustness.test.ts` "CP-104" |
| CP-201..202 | `consult.ts › readPartNumber, formatPartNumber` | replay; "CP-202" |
| CP-301..302 | `consult.ts › readFaultCodes, clearFaultCodes` | replay; `test/simulator.test.ts` "clears fault codes (CP-302)" |
| CP-401..405 | `consult.ts › stream`, `src/protocol/registers/` | replay; `robustness.test.ts` "CP-402"; "LD-102: paging" |
| CP-501..502 | `consult.ts › probeRegister`, `session.ts › detectParams` | "reports unsupported registers with FE (CP-501)" |
