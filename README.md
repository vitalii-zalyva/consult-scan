# Consult Scan

[![CI](https://github.com/vitalii-zalyva/consult-scan/actions/workflows/ci.yml/badge.svg)](https://github.com/vitalii-zalyva/consult-scan/actions/workflows/ci.yml)

Nissan **Consult-I** diagnostics in the browser. It talks to the engine ECU of a 1998 Nissan Maxima (A32, VQ30DE)
over a 14-pin Consult USB cable, shows every live value the ECU reports, flags values outside the service-manual
reference ranges, and reads and clears fault codes. No install, no backend: Chrome or Edge on macOS (or Windows).

**Live demo:** https://consult-scan.vercel.app. Press **Start demo** to run it against the built-in simulated ECU,
so no cable is needed.

A pet project, tested on the real car: ECU `23710-44U01`, key-on and warm-idle sessions recorded on 2026-10-13
are part of the test suite.

## What it does

- **Live data:** 44 engine parameters plus A/T and climate units, decoded from raw register bytes, with raw hex
  and a 30 s trend per value. Registers the ECU does not support are detected and skipped.
- **Reference checks:** 28 range rules from the VQ30DE service manual, applied per engine condition (engine off,
  warming up, warm idle, 2000 rpm, driving), judged on a 3 s mean with a 2 s hold so noise does not flicker.
- **Fault codes:** read, decode and clear (behind a confirmation); 69 codes with names and first checks.
- **Diagnosis hints:** 19 rules turn live data, history and codes into possible problems (vacuum leak, lazy O2
  sensor, thermostat, charging, idle control) with the evidence and what to check first.
- **Cylinder health:** a power balance test (the one active test in the app) and a compression-test log.
- **Fuel consumption** derived from injector pulse width, with fill-up calibration.
- **Recording:** CSV export of live data and a raw traffic log of every byte on the wire.

## How it works

```
src/transport/   web-serial/, webusb-ftdi/ (fallback), simulator/, byte-queue/ + the Transport interface
src/protocol/    consult/ (wire client), registers/ (map + decoders), fault-codes/, units/, session/,
                 power-balance-runner/
src/simulator/   fake-ecu/ (byte-accurate fake ECU), engine-model/ (VQ30DE behaviour)
src/analysis/    conditions/, reference-ranges/, evaluate/, diagnosis/, fuel/, power-balance/, compression/
src/logging/     csv/, cylinder-store/
src/ui/          App/, components/<Name>/, messages/ (all UI text), lib/, styles/
```

Layering is strict: `ui → protocol/session → protocol/consult → transport`. The protocol layer never touches the
DOM or `navigator`. It emits structured progress events and error codes, and the UI turns them into text.

Every module is a folder with an `index.ts` barrel, `src/transport/types.ts` and `constants.ts` next to the logic, and other modules
import it as `@/protocol/registers`, never its internals. React components live in their own folders with a CSS
module and a `NameProps` type. ESLint enforces the import rules.

The wire protocol is 9600 8N1 request/response: init `FF FF EF`, the ECU echoes each command byte bit-inverted,
`5A rr` adds a register to the stream, `F0` starts frames (`FF <len> <data>`), `30` stops. Fault codes come from `D1`,
the part number from `D0`. See [docs/consult-protocol.md](docs/consult-protocol.md).

Some details that came out of the real car:

- **Two cable paths.** Web Serial uses the macOS driver. Cables with a custom USB ID are not bound by that driver,
  so a WebUSB transport talks to the FTDI chip directly (baud divisor, modem-status bytes in every packet).
- **The recordings corrected the register map.** The generic register table did not fit this ECU. REF rpm is a period,
  not a speed, load has a fraction byte, and a fault-code byte is two hex digits. Registers that still contradict the
  data are tagged "suspect" and kept out of checks and calculations (spec 013).
- **Safety first for the active test.** The power balance test cuts one cylinder at a time (`0A 88`). It runs only
  through `PowerBalanceRunner`: warm idle, stationary, explicit confirmation, cuts of at most 4 s, and a restore of all
  cylinders on every exit path, including disconnect, Stop and an ECU that ignores the restore. Every other active test
  is out of scope.

## Testing

```sh
npm run check       # typecheck, ESLint, Prettier, Vitest (CI runs this and the build)
```

- **Real ECU replay:** a recorded byte log (OpenConsult) is replayed through the protocol client.
- **Real car data:** CSV recordings from the A32 are replayed through evaluation and the corrected decoders.
- **Simulator:** the fake ECU answers byte for byte like a real one, including streams, stop handling,
  unsupported registers and fault injection (ignored STOP, ignored restore, stall on cut). The power balance runner
  is tested against it on every abort path.
- **UI:** static render checks plus interaction tests with Testing Library (connect, confirm before clearing codes).

## Run locally

```sh
npm install
npm run dev         # open the printed URL in Chrome or Edge
```

Choose **USB cable (serial)**, press Connect and pick the `usbserial…` device. If it does not show up, try
**USB cable (direct FTDI)**. Without a cable, choose **Simulator**.

`VITE_PUBLIC_DEMO=1 npm run build` produces the public demo build (the one deployed to Vercel).

## How it was built

Development is spec-driven. Every behaviour starts as requirements with IDs in [`specs/`](specs/README.md), and code
and tests reference those IDs (`// CY-203`, test names like `"CY-203: requested cut length is clamped"`).

The project was built with Claude Code as a coding assistant, set up with guardrails from the start:

- [`CLAUDE.md`](CLAUDE.md): the working agreement, code structure and the safety rules for car-facing code.
- **Hooks** ([`.claude/settings.json`](.claude/settings.json), [`.claude/hooks/`](.claude/hooks)): an ECU safety guard
  that blocks edits adding ECU write paths outside the reviewed modules, format + lint + typecheck after every edit,
  tests before a turn can finish, and a git guard (Conventional Commits, no force-push, no secrets or raw car logs in git).
- **Agents** ([`.claude/agents/`](.claude/agents)): spec writer, implementer, UI implementer, spec reviewer, UI reviewer
  and a protocol analyst for logs brought back from the car.

## Limitations

- Tested on one car and one ECU. Other Consult-I ECUs should work for the generic registers, but the reference ranges
  are for the VQ30DE.
- Most reference ranges come from US service-manual sources and are marked unverified for this European car. Treat
  highlights as hints, not verdicts.
- Do not use the app while driving.

## License

[MIT](LICENSE)
