# 006 — Fault codes

- **Status:** implemented
- **Prefix:** FC
- **Related:** 001 (CP-3xx)

## Requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| FC-101 | Code number = decimal value of the code byte (OpenConsult convention); `55` = no malfunction and is not listed. | `0x33` → 51; `55 00` → empty list. |
| FC-102 | Each code shows number, name, "present now" (0 starts) vs "last seen N starts ago", and a short first-check hint where known. | FaultCodesPanel. |
| FC-103 | Unknown codes MUST still be shown with decimal and raw hex. | `0xFA` → "Unknown code 250 (raw 0xfa)". |
| FC-104 | Codes are read automatically on connect and on demand. | LD-101. |
| FC-201 | Clearing MUST require explicit confirmation that warns the information is lost, and re-read codes afterwards. | `window.confirm` before `C1`. |

## Safety
`C1` erases stored diagnosis and resets the ECU's self-learned trims on some ECUs. Only on explicit user action, never automatic.

## Open questions
- [ ] Does the A32 VQ30DE ECU report 2-digit (11–55) or extended (up to 128) codes? US OBD-II-era ECUs may differ. → car session.
- [ ] Confirm the decimal interpretation (vs. hex digits) on the car: a known fault (e.g. unplug MAF with engine off, key on) should produce code 12.

## Traceability
| ID | Code | Test |
|---|---|---|
| FC-101, 103 | `src/protocol/fault-codes/` | "CP-301: fault code parsing" |
| FC-102, 104, 201 | `src/ui/components/FaultCodesPanel/`, `src/ui/App/` | manual |
