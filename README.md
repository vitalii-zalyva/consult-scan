# Consult Scan

[![CI](https://github.com/vitalii-zalyva/consult-scan/actions/workflows/ci.yml/badge.svg)](https://github.com/vitalii-zalyva/consult-scan/actions/workflows/ci.yml)

Nissan **Consult-I** diagnostics in the browser, for macOS (works on Windows too). Target car: **1998 Nissan Maxima
A32, VQ30DE**, with a 14-pin Consult USB cable. Chrome or Edge (Web Serial / WebUSB), no backend.

- Live data for every register the ECU supports, with trends
- Out-of-range highlighting against VQ30DE service-manual reference values, depending on engine condition
- Read / clear fault codes with descriptions
- CSV recording and raw traffic log
- Built-in byte-accurate ECU simulator, so no car is needed for development

## Run

```sh
npm install
npm run dev     # open the printed URL in Chrome or Edge
npm run check   # typecheck, lint, format check, tests
```

In the app choose **USB cable (serial)** → Connect → pick `usbserial…`. If the cable doesn't show up, try
**USB cable (direct FTDI)**. Without a cable, choose **Simulator**.

## How the project is organised

- `specs/` — requirements with IDs, the source of truth (start at `specs/README.md`)
- `src/` — layered: `ui → protocol → transport`, one folder per module with an `index.ts` barrel, `@/` imports
- `CLAUDE.md`, `.claude/` — working agreement, agents and guardrail hooks for Claude Code
- `docs/consult-protocol.md` — protocol reference

⚠️ Reference ranges are not yet verified against the FSM for this exact car; treat highlights as hints.
Don't operate the app while driving.

## License

[MIT](LICENSE)
