# 002 — Transports

- **Status:** implemented (not yet run with the real cable)
- **Prefix:** TR
- **Related:** 001-consult-protocol

## Context
The cable is a USB-serial chip (usually FTDI FT232R, sometimes CH340) plus a level shifter. On macOS, standard
FTDI/CH34x chips appear as `/dev/cu.usbserial-*`. Some Consult cables use custom VID/PIDs that the system driver ignores.

## Requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| TR-001 | All transports MUST implement `Transport` (open/close/write/read(count, timeout)/drain/onTraffic). | Type check. |
| TR-002 | `read` MUST resolve with exactly `count` bytes or reject with `TimeoutError`. | `ByteQueue` behaviour, used by all tests. |
| TR-003 | Every transport MUST report raw TX/RX bytes to `onTraffic` (for the traffic log, LOG-201). | UI traffic log shows `W`/`R` lines. |
| TR-101 | Web Serial MUST open at 9600 baud, 8 data bits, 1 stop bit, no parity, no flow control. | `CONSULT_SERIAL_OPTIONS`. |
| TR-102 | Web Serial MUST be selectable only when `navigator.serial` exists; otherwise the UI explains to use Chrome/Edge. | Notice rendered in Safari. |
| TR-103 | Recoverable read errors (framing/parity/break) SHOULD NOT end the session. | `pump()` re-acquires the reader. |
| TR-201 | WebUSB FTDI fallback MUST configure the chip directly: reset, baud 9600 (`value 0x4138`), 8N1, no flow control, DTR/RTS on, latency 2 ms. | Code review; car session. |
| TR-202 | The FTDI transport MUST strip the 2 modem-status bytes at the start of every max-packet-size chunk. | "TR-2xx: FTDI packet status stripping" test. |
| TR-203 | The device chooser MUST list all USB devices (no VID filter), since cable VID/PIDs vary. | `requestDevice({ filters: [] })`. |

## Out of scope
Bluetooth Consult adapters, ELM327 (cannot speak Consult-I), PL2303 clones.

## Open questions
- [ ] Which chip / VID:PID is in the user's cable? → `system_profiler SPUSBDataType` once the cable is at hand.
- [ ] Does macOS bind its FTDI driver to this cable? If yes, WebUSB claimInterface will fail and Web Serial is the path.
- [ ] Is the ECU clock supplied by the cable, or does the A32 ECU self-clock? (Affects nothing in software unless init fails.)

## Traceability
| ID | Code | Test |
|---|---|---|
| TR-001..003 | `src/transport/types.ts`, `src/transport/byte-queue/` | all protocol tests |
| TR-101..103 | `src/transport/web-serial/` | manual (car session) |
| TR-201..203 | `src/transport/webusb-ftdi/` | `test/analysis.test.ts` "TR-2xx"; manual |
