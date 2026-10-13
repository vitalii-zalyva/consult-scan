# 006 — Fault codes

- **Status:** implemented
- **Prefix:** FC
- **Related:** 001 (CP-3xx)

## Requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FC-101 | Code number = the code byte read as **two hex digits** (`0x12` → 12); code `55` (byte `0x55`) = no malfunction and is not listed. *Revised 2026-10-13 (was: decimal value, OpenConsult).* Sources: PLMS *Consult Protocol & Commands Issue 6* (`FF 02 55 00` = no fault; `13 00 08 03` = codes 13 and 8); A32 car reported byte `0x12` — decimal 18 is no Nissan code, 12 is MAF. | `0x12 06` → code 12, 6 starts ago; `55 00` → empty list. |
| FC-102 | Each code shows number, name, "present now" (0 starts) vs "last seen N starts ago", and a short first-check hint where known. | FaultCodesPanel. |
| FC-103 | Unknown codes MUST still be shown with decimal and raw hex. | `0xFA` → "Unknown code 250 (raw 0xfa)". |
| FC-105 | Codes 100–159 (FSM lists 101, 103, 105, 108) MUST be read as high nibble = tens 10–15 (`0xA1` → 101; inferred — the only one-byte form consistent with FC-101). A byte whose low nibble is above 9 is not a digit pair and MUST fall back to its decimal value, still showing the raw byte. | `0xA1` → 101; `0xFA` → 250; `0x6F` → 111. |
| FC-106 | Code names MUST follow the FSM DTC index (1995 US Maxima EC contents, 2-digit codes — http://pdf.textfiles.com/manuals/AUTOMOBILE/NISSAN/maxima/1995/ec.pdf): 33 front HO2S left bank (bank 2), 53 front HO2S right bank (bank 1), 37/38 closed-loop control right/left, 72/73 catalyst, 76/86 fuel injection right/left, 82 CKPS (POS), 91/101 front HO2S heater right/left. | `0x33` → "…left bank (bank 2)". |
| FC-104 | Codes are read automatically on connect and on demand. | LD-101. |
| FC-201 | Clearing MUST require explicit confirmation that warns the information is lost, and re-read codes afterwards. | `window.confirm` before `C1`. |

## Safety
`C1` erases stored diagnosis and resets the ECU's self-learned trims on some ECUs. Only on explicit user action, never automatic.

## Open questions
- [ ] Does the A32 VQ30DE ECU report 2-digit (11–55) or extended (up to 128) codes? US OBD-II-era ECUs may differ. → car session.
- [x] Decimal vs hex digits → hex digits (FC-101 revised). Final proof on the car: the no-fault reply after clearing should be `55 00`.
- [ ] The A32's stored code 12 (MAF circuit, last seen 6 starts before 2026-10-13) — intermittent MAF wiring/connector? → user.

## Traceability
| ID | Code | Test |
|---|---|---|
| FC-101, 103, 105, 106 | `src/protocol/fault-codes/ › decodeFaultByte, encodeFaultCode, TABLE` | "CP-301: fault code parsing" › FC-101, FC-103/105, FC-105, FC-106 |
| FC-102, 104, 201 | `src/ui/components/FaultCodesPanel/`, `src/ui/App/` | manual |
