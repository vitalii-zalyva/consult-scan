# Consult Scan — Nissan Consult-I diagnostics for macOS

Browser app (Chrome/Edge, Web Serial / WebUSB) that reads the ECU of a **1998 Nissan Maxima A32, VQ30DE**
through a 14-pin Consult USB cable, shows all live data, flags values outside the FSM reference ranges,
and reads/clears fault codes. No backend.

## Commands

- `npm run dev` — Vite dev server (open in **Chrome**; Safari/Firefox have no Web Serial)
- `npm test` — Vitest (protocol replay of a real ECU log, simulator, analysis, UI)
- `npm run check` — typecheck + ESLint + Prettier check + tests (CI runs the same, plus `npm run build`)
- `npm run lint` / `npm run format` / `npm run typecheck` / `npm run build`

## Spec-driven development (mandatory)

Every behaviour change starts in `specs/`. Workflow and templates: `.claude/skills/spec-driven-development/SKILL.md`.

1. **Spec** — add/modify requirements in `specs/NNN-feature/spec.md` (IDs like `CP-401`). Status `draft` → `approved` needs user OK.
2. **Plan + tasks** — `plan.md` / `tasks.md` in the same folder for non-trivial work.
3. **Implement** — reference requirement IDs in code comments at module/function level (`// CP-401`) and in test names.
4. **Verify** — `npm run check`; update the spec's traceability table; flip status to `implemented`.

Never implement behaviour that is not in a spec; if you find a gap, write the spec change first and say so.

## Architecture

```
src/transport/   Transport interface, errors, constants; web-serial/, webusb-ftdi/ (fallback), simulator/, byte-queue/
src/protocol/    consult/ (wire protocol client), registers/ (engine map + decoders), units/ (A/T, climate),
                 fault-codes/, session/
src/simulator/   fake-ecu/ (byte-accurate fake ECU), engine-model/ (VQ30DE behaviour)
src/analysis/    conditions/, reference-ranges/ (VQ30DE FSM values), evaluate/, fuel/, diagnosis/
src/logging/     csv/ export
src/ui/          App/, components/<Name>/, messages/ (all UI text), lib/, styles/global.css
specs/           Source of truth for behaviour
docs/            Protocol reference, hardware notes
test/            *.test.ts(x) in node, *.dom.test.tsx in jsdom; fixtures/ = real ECU byte logs and car recordings
```

Layering: `ui → protocol/session → protocol/consult → transport`. Protocol code must not touch DOM or `navigator`.

## Code structure

- One folder per module, kebab-case (`src/protocol/fault-codes/`); components in PascalCase folders
  (`src/ui/components/FuelPanel/`).
- Inside a module: `types.ts` (interfaces, type aliases), `constants.ts` (constants and fixed tables), logic in named
  files (`ConsultClient.ts`, `parse.ts`), and `index.ts` re-exporting the public API. Never mix types and constants
  into the logic file.
- Import another module only through its barrel with the `@/` alias (`import { ConsultSession } from "@/protocol/session"`).
  No `../` imports and no reaching into another module's files; inside a module use `./file`. ESLint enforces both.
- Every layer has an `index.ts` (`@/protocol`, `@/analysis`, …) for the app shell and tests. Modules inside a layer
  import each other through module barrels, never through their own layer barrel (no import cycles).
- Components: `Name.tsx`, `Name.module.css`, `types.ts` (`NameProps`), `index.ts`. Class names go through
  `createCx(styles)` from `@/ui/lib`; shared state classes (`st-*`, `card`, `muted`) live in `src/ui/styles/global.css`.
- Interaction tests use Testing Library + user-event in `test/*.dom.test.tsx`; query by role and label.

## Safety rules (car-facing code)

- Only **read** commands are allowed by default: init `FF FF <unit>` (EF engine, EA A/T, DF climate, E4 HICAS), `D0`, `D1`, `5A`, `F0`, `30`.
- `C1` (clear codes) only behind an explicit user confirmation (FC-201).
- **Active tests (`0A`) and anything else that changes ECU behaviour (fuel cut, timing, AAC override, self-learn clear)
  are out of scope** unless a spec explicitly approved by the user says otherwise. ROM read (`C9`) also needs its own spec.
- Never present unverified reference ranges as authoritative: keep `verified: false` until checked against the FSM.

## Guardrails (Claude Code hooks in `.claude/settings.json`)

- `ecu-guard` (before every edit): blocks ROM read (`C9`), any active test (`0A`) — none is approved, and `CMD.CLEAR_FAULT_CODES` or raw
  `transport.write` outside the protocol client, transports and simulator.
- `post-edit-check` (after every edit): Prettier, ESLint on the file, project typecheck; failures go back to Claude.
- `stop-tests` (end of turn): tests related to the uncommitted changes must pass.
- `git-guard`: Conventional Commits (`feat(ui): …`, lowercase subject), no force-push, no `--no-verify`, no Co-Authored-By trailers, no `.env` / `logs/` / `.vercel/` in git,
  no destructive resets without asking.

Hooks are a safety net, not the review: car-facing changes still need an approved spec and the `spec-reviewer` agent.

## Agents (`.claude/agents/`)

`spec-writer` → `implementer` (protocol, analysis) / `ui-implementer` (React) → `spec-reviewer` + `ui-reviewer`.
`protocol-analyst` decodes traffic logs and CSVs brought back from the car.

## Conventions

- TypeScript strict, no `any`. Each module's main file starts with a header comment naming the spec.
- Register scalings and ranges must cite a source; mark unconfirmed ones `verified: false`.
- New protocol behaviour needs a test against the simulator **and**, when available, a recorded real-ECU fixture.
- UI strings live in `src/ui/messages/`; car data texts next to their definitions; diagnosis texts in
  `src/analysis/diagnosis/` (LD-401). Protocol code emits progress events and error codes, never UI text (LD-402).
- The hardware is not attached to the dev machine: never claim something works on the car unless the user ran it.
