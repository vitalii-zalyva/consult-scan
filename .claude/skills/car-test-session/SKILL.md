---
name: car-test-session
description: Prepare for and analyse a test session on the real car (Maxima A32 VQ30DE). Use when the user is about to connect the cable to the car, or brings back a traffic log / CSV / screenshot from the car and wants it interpreted or turned into fixes.
---

# Real-car test session

The dev machine has no cable or car. Everything on the car is done by the user; you prepare and analyse.

## Before the session — give the user this checklist

1. On the Mac with only the cable plugged in (no car): `system_profiler SPUSBDataType` and `ls /dev/cu.*`.
   - FTDI vendor `0x0403` and a `/dev/cu.usbserial-*` → use **USB cable (serial)**.
   - Vendor ID but no `/dev/cu.*` → use **USB cable (direct FTDI)** (WebUSB fallback, TR-2xx).
   - CH340 `0x1a86` → serial should work on macOS 11+.
2. `npm run dev`, open the URL in **Chrome**.
3. In the car: ignition ON, connect cable to the 14-pin grey socket (driver side, near fuse box), then Connect.
4. Collect, in this order: ECU part number, fault codes (write them down **before** clearing), 1 min warm idle, 30 s at steady 2000 rpm in N/P.
5. Press **Save traffic log** and **Record CSV**; bring both files back.

## After the session — analysis steps

1. Read the traffic log (`W`/`R` hex lines). Check: init `ffffef`→`10`, which `5a xx` got `fe` (unsupported), frame lengths.
2. Update `SIM_SUPPORTED_REGISTERS` and the spec's open questions with the real supported-register set.
3. Copy a trimmed log to `test/fixtures/a32-vq30de-<date>.txt` and add a replay test (CP traceability).
4. From the CSV: compare warm-idle / 2000 rpm values against `src/analysis/reference-ranges/`. A value off on a healthy-running car more likely means a wrong scaling (fix `src/protocol/registers/`) than a fault — reason about which.
5. Flip `verified: true` only for registers / ranges the data actually confirmed, and record the evidence in the spec.
6. Ask the user before moving any spec to `verified-on-car`.

## Safety

Never ask the user to watch the laptop while driving. Data collection while moving needs a passenger or recording mode.
