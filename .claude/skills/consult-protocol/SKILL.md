---
name: consult-protocol
description: Nissan Consult-I protocol reference (bytes, registers, fault codes, timing) for this repo. Use when changing src/protocol, src/simulator or src/transport, decoding a captured traffic log, or adding registers / fault codes / reference ranges.
---

# Consult-I quick reference

Full reference: `docs/consult-protocol.md`. Authoritative behaviour: `specs/001-consult-protocol/spec.md`.

## Wire

- 9600 baud, 8N1, no flow control. The cable (FTDI/CH340 + level shifter) provides the clock.
- Init: `FF FF <unit>` → `10`. Unit byte: `EF` engine, `EA` A/T, `DF` auto A/C, `E4` HICAS (PLMS).
- Command bytes are echoed **bit-inverted** (`5A`→`A5`, `D1`→`2E`, `D0`→`2F`); data bytes (register addresses) are echoed unchanged.
- Unsupported register / invalid command → `FE`.
- `F0` starts output: frames `FF <len> <data…>` repeated until `30`; ECU ends with `CF` (frames in flight may come first).
- Max 20 register bytes per stream; more needs paging (see `pageParams`).

## Commands

| Cmd | Meaning | Echo |
|---|---|---|
| `5A rr` | add register `rr` to the stream | `A5 rr` |
| `D0` | ECU part number (22-byte frame, ASCII suffix in bytes 17–21) | `2F` |
| `D1` | fault codes, pairs `[code, startsSince]`, code = byte as two hex digits (0x12 → 12, FC-101), 0x55 = none | `2E` |
| `C1` | clear fault codes (needs user confirmation) | `3E` |
| `F0` / `30` | go / stop | — / `CF` |
| `C9 hi lo` | ROM/RAM byte read (max 8 per request) — not used, needs a spec | `36 hi lo` |
| `0A 88 mm` | power balance (spec 012): `mm` = one cylinder bit, `00` = all firing. Only via `PowerBalanceRunner` | `F5 88 mm` |
| `0A tt dd` (other `tt`) | other active tests — **forbidden** without an approved safety spec | — |

Register `0xFE` echoes as `FE`, same as the invalid reply: treat a probe without a frame as unsupported (CP-503).

## Decoding a traffic log

The app's "Save traffic log" writes `W <hex>` / `R <hex>` lines (same format as `test/fixtures/*.txt`).
To turn a real capture into a regression test, drop it in `test/fixtures/` and replay it with `ReplayTransport`.

## When adding a register or range

1. Add it to `PARAMS` in `src/protocol/registers/` (or a unit list in `src/protocol/units/`) with source + `verified: false`. Decoders must be linear — the simulator inverts them generically (`encodeParam`).
2. If the VQ30DE has it, add it to `SIM_SUPPORTED_REGISTERS` and give it a value in `src/simulator/engine-model/`.
3. Reference ranges go in `src/analysis/reference-ranges/` with the FSM wording in `note`.
4. Update the spec tables and tests.
