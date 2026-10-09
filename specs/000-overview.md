# 000 — Product overview

- **Status:** approved (by user, 2026-10-09)

## Goal
Read the ECU of a **1998 Nissan Maxima A32 (VQ30DE)** from a **MacBook** using a **14-pin Nissan Consult USB cable**
(through a USB-A → USB-C adapter). Windows has NDS I/II, ConZult and others; macOS has nothing.

## Users
The car owner (software engineer, not a Nissan technician). Values need plain-language explanations next to the FSM terms.

## Product decisions
| Decision | Choice | Why |
|---|---|---|
| Platform | Browser app, Chrome/Edge, no backend | Web Serial works on macOS with no install; the same build runs on Windows |
| Protocol | Nissan Consult-I (DDL1), 9600 8N1 | 14-pin grey connector, 1989–2001 ECUs |
| Fallback | WebUSB driver for FTDI chips | Cables with custom VID/PID are not bound by the macOS FTDI driver |
| Dev without car | Byte-accurate simulator + real-ECU log replay | Hardware not available at the dev machine |
| Language | TypeScript strict, React, Vite, Vitest | |

## Scope v0.1
1. Connect, read the ECU part number, detect which data the ECU supports (001, 002).
2. Show **all** supported live values, decoded, with trends (004).
3. Mark values outside the VQ30DE reference ranges for the current engine condition, plus history-based checks (005).
4. Read and clear (confirmed) fault codes with descriptions (006).
5. CSV recording and raw traffic log (007).

## Non-goals v0.1
Active tests, ECU writes other than clear codes, ROM reading/tuning, Consult-II/III (K-line/CAN), Safari/Firefox support.

## Sources
- Nisscan, *Which NDS software* — Consult I/II/III generations: https://nisscan.com/which-nds-software/
- OpenConsult (GPLv3) — register map, command flow, real ECU log: https://github.com/jonsim/openconsult
- ECCS tech forum — cable and clock (153.6 kHz = 16 × 9600): https://www.tapatalk.com/groups/eccstech/who-can-do-a-consult-cable-write-up-t1430.html
- Nissan FSM 1995–1999 Maxima, section EC (reference values) — **to be checked by the user; values in 005 are unverified**.
