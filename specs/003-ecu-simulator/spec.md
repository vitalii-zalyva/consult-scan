# 003 — ECU simulator

- **Status:** implemented
- **Prefix:** SIM
- **Related:** 001, 004, 005

## Context
The developer machine has no car. A byte-accurate fake ECU lets the whole stack (protocol → UI) run and be tested.

## Requirements

### Protocol behaviour (SIM-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| SIM-101 | MUST answer `FF FF EF` with `10` at any time and reset its state. | Simulator tests connect. |
| SIM-102 | MUST echo commands like the real ECU (inverted command, raw data byte) and answer `FE` for unsupported registers. | CP-501 test. |
| SIM-103 | MUST stream frames `FF <len> <data>` periodically after `F0` (default every 40 ms) until `30`, then send `CF`. | Stream test. |
| SIM-104 | MUST return the real part-number frame from the OpenConsult log for `D0`. | Part number contains `23710-`. |
| SIM-105 | MUST hold a fault-code list (default `[34, 3 starts]`), return `55 00` when empty, and clear it on `C1`+`F0`. | CP-302 test. |
| SIM-106 | Supported register set MUST model a VQ30DE (single MAF, no turbo, no fuel temp). | `SIM_SUPPORTED_REGISTERS`. |

### Engine model (SIM-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| SIM-201 | Coolant warms from 20 °C towards 88 °C (accelerated), idle rpm falls from ~1100 to ~700 as it warms. | Visual in UI. |
| SIM-202 | Warm closed loop: front O2 switches ~1.2 Hz between ~0.05 and ~0.85 V; A/F alpha oscillates around 100 %. | O2 check passes in healthy state. |
| SIM-203 | Values in healthy warm idle / 2000 rpm MUST fall inside the 005 reference ranges. | Test settles the model and evaluates every sample. |

### Controls (SIM-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| SIM-301 | UI MUST offer scenarios: key ON engine off, idle, 2000 rpm, driving. | SimulatorPanel. |
| SIM-302 | UI MUST offer injectable faults: lazy O2, vacuum leak, MAF high, overheat, weak alternator; plus "store DTC 33" and "cold restart". | Each fault turns the related row/finding yellow/red. |

## Traceability
| ID | Code | Test |
|---|---|---|
| SIM-1xx | `src/simulator/fake-ecu/`, `src/transport/simulator/` | `test/simulator.test.ts` |
| SIM-2xx | `src/simulator/engine-model/` | `test/robustness.test.ts` "SIM-203" |
| SIM-3xx | `src/ui/components/SimulatorPanel/` | manual |
