# Nissan Consult-I protocol reference

Applies to Nissan ECUs with the grey **14-pin** diagnostic connector (≈1989–2001), incl. the 1998 Maxima A32 VQ30DE.
Consult-II (K-line) and Consult-III (CAN) are different protocols on the 16-pin OBD-II connector.

## Physical layer
- Signals on the 14-pin socket: +12 V, GND, ECU TX, ECU RX, clock (and CHK, unused).
- TTL-level serial; the USB cable contains a USB-UART (FTDI FT232R / CH340) plus level shifting.
- Some ECUs need a 153.6 kHz clock (16 × 9600) supplied by the cable.
- **9600 baud, 8 data bits, no parity, 1 stop bit, no flow control.**

## Session
```
host: FF FF EF            ECU: 10                    init
host: D0                  ECU: 2F                    part number request (echo = ~cmd)
host: F0                  ECU: FF 16 <22 bytes>      frame (repeats until stopped)
host: 30                  ECU: [frames in flight] CF stop
```

## Commands
| Host | Echo | Notes |
|---|---|---|
| `FF FF EF` | `10` | init / re-init |
| `5A rr` | `A5 rr` | add register `rr`; up to 20 per stream; `FE` if unsupported |
| `D0` | `2F` | ECU part number: 22 bytes, bytes 17–21 ASCII suffix of `23710-xxxxx` |
| `D1` | `2E` | fault codes: pairs `[code, starts-since-seen]`, code = byte read as two hex digits (`0x12` → 12, FC-101), `55` = none |
| `C1` | `3E` | clear fault codes |
| `F0` | — | start sending |
| `30` | `CF` | stop |
| invalid | `FE` | |
| `C9 hi lo` | `36 hi lo` | ROM/RAM byte read, up to 8 per request (not used by the app) |
| `0A 88 mm` | `F5 88 mm` | power balance: bit n = cylinder n+1 off, `00` = all firing (spec 012, safety interlocks) |
| `0A tt dd` (other) | | other active tests — change engine behaviour, **not used** |

Control unit select (third init byte, PLMS): `EF` engine, `EA` automatic transmission, `DF` auto air-con, `E4` HICAS.

Echo rule: every **command** byte comes back bit-inverted; **data** bytes (register addresses) come back unchanged.

## Example (real ECU, OpenConsult log)
```
W 5a005a015a0b5a0c        rpm MSB/LSB, speed, battery
R a500a501a50ba50c
W f0
R ff04 0075 00 b4         rpm 0x0075×12.5 = 1462.5, speed 0, battery 0xb4×0.08 = 14.4 V
W 30
R ff04007600b5 cf         last frame in flight, then CF
```

## Register map
See `specs/001-consult-protocol/spec.md` (single source of truth) and `src/protocol/registers/`.

## Sources
- OpenConsult: https://github.com/jonsim/openconsult
- Nisscan (NDS I/II/III generations): https://nisscan.com/which-nds-software/
- ECCS tech forum cable write-up: https://www.tapatalk.com/groups/eccstech/who-can-do-a-consult-cable-write-up-t1430.html
- Elektroda Consult thread: https://www.elektroda.pl/rtvforum/topic885199.html
