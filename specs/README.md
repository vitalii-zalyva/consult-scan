# Specs index

Workflow: `.claude/skills/spec-driven-development/SKILL.md`. Statuses: draft → approved → implemented → verified-on-car.

| # | Spec | Prefix | Status |
|---|---|---|---|
| 000 | [Product overview](000-overview.md) | — | approved |
| 001 | [Consult-I protocol client](001-consult-protocol/spec.md) | CP | implemented |
| 002 | [Transports (Web Serial, WebUSB FTDI)](002-transports/spec.md) | TR | implemented |
| 003 | [ECU simulator](003-ecu-simulator/spec.md) | SIM | implemented |
| 004 | [Live data dashboard](004-live-dashboard/spec.md) | LD | implemented |
| 005 | [Reference ranges & checks (VQ30DE)](005-reference-ranges/spec.md) | RR | implemented (ranges unverified) |
| 006 | [Fault codes](006-fault-codes/spec.md) | FC | implemented |
| 007 | [Data logging](007-data-logging/spec.md) | LOG | implemented |
| 008 | [Maximum data coverage (full register map, bit labels, deep scan)](008-extended-data/spec.md) | XD | implemented |
| 009 | [Other control units (A/T, climate)](009-other-control-units/spec.md) | CU | implemented |
| 010 | [Fuel consumption (derived)](010-fuel-consumption/spec.md) | FU | implemented (injector size unverified) |
| 011 | [Possible problems (diagnosis hints)](011-diagnosis/spec.md) | DX | implemented (thresholds untuned) |
| 012 | [Cylinder health: power balance + compression log](012-cylinder-health/spec.md) | CY | implemented — first car run must be the dry run |
| 013 | [A32 register map corrections (first car session)](013-a32-register-corrections/spec.md) | RC | implemented |
| 014 | [Public demo build (Vercel)](014-public-demo/spec.md) | DM | implemented |

Nothing is `verified-on-car` yet. First real-car data (ECU 23710-44U01, 2026-10-13, engine off + warm idle) is analysed in spec 013.

## Backlog (no spec yet)

- Gauges view / full-screen dashboard
- CSV replay mode (load a recorded file instead of the car)
- Fuel columns (L/h, L/100 km) in the CSV export
- Confirm bit positions (008) and A/T presence (009) after a car session
- ABS / airbag units: select bytes unknown — wider select-byte scan needs a spec
- ROM read (`C9`) for ECU identification — read-only but large; needs a spec
- Other active tests (fuel %, timing, AAC, fuel pump, self-learn clear) — **require their own safety-reviewed spec**
