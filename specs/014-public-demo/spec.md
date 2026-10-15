# 014 — Public demo build

- **Status:** implemented (approved by user 2026-10-15)
- **Prefix:** DM
- **Related:** 002 (transports), 003 (ECU simulator), 012 (cylinder health)

## Context
The app is shared as a public link. A visitor usually has no cable and spends seconds on the page, so the public build
must explain what it is and open an obvious simulator demo in one click. The USB transports stay available so someone
with a Consult cable can try the real thing. The local build (`npm run dev` / `npm run build`) is unchanged.

## Requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| DM-101 | The public demo build is selected at build time with `VITE_PUBLIC_DEMO=1`; without it the app behaves as before. | Local build: no banner, cable preselected when Web Serial exists. |
| DM-103 | The demo build preselects the simulator source; the USB sources (Web Serial, WebUSB FTDI) stay in the selector. | Demo render: simulator selected, cable options present. |
| DM-104 | While disconnected, the demo build shows a banner above the intro: what the app is (pet project, 1998 Nissan Maxima A32 VQ30DE, Consult-I, tested on the real car), that the demo runs a byte-accurate simulated ECU, and a primary **Start demo** button that connects to the simulator. | Banner and button rendered; click connects with the simulator transport. |
| DM-105 | The banner says how to use a real cable instead (pick USB cable, Chrome or Edge). The cable intro steps stay visible below the banner. | Text present. |
| DM-107 | `index.html` has a meta description. Vercel builds the demo from `vercel.json` (static Vite output, no backend). | `vercel.json` sets `VITE_PUBLIC_DEMO=1`. |

## Out of scope
Analytics, custom domain.

## Safety
The public page can reach a real ECU when a visitor connects a cable. No new commands are added: the power balance test
keeps every spec 012 interlock (warm idle, stationary, confirmation, cuts of at most 4 s, restore on every path) and
clearing codes keeps the FC-201 confirmation.

## Traceability

| ID | Code | Test |
|---|---|---|
| DM-101 | `src/config/`, `src/ui/App/` | `test/demo.test.tsx › "DM-101: …"` |
| DM-103 | `src/ui/App/` | `test/demo.test.tsx › "DM-103: …"` |
| DM-104, DM-105 | `src/ui/App/` (`DemoBanner`), `src/ui/messages/ › demo` | `test/demo.test.tsx › "DM-104, DM-105: …"` |
| DM-107 | `index.html`, `vercel.json` | — |
