# 004 — Live data dashboard

- **Status:** implemented (simple v0.1 UI)
- **Prefix:** LD
- **Related:** 001, 005, 007

## Requirements

### Session flow (LD-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| LD-101 | On Connect: open transport → init → part number → detect registers → read fault codes → start streaming. Progress shown in the status line. | Simulator connect shows each step. |
| LD-102 | MUST stream **all** supported params. If they need more than 20 register bytes, rotate pages (default 6 frames each); values persist between pages. | Session test: every supported param seen. |
| LD-103 | Reading/clearing fault codes MUST pause and resume the stream automatically. | Session test reads codes mid-stream. |
| LD-104 | ECU operations MUST be serialised (never two commands in flight). | `ConsultSession.exclusive`. |
| LD-105 | Errors MUST show in the status line in plain language; state goes to `error`. | Init failure message. |

### Display (LD-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| LD-201 | Group values: Engine, Air/fuel, Ignition, Sensors. Each row: friendly name, FSM monitor name, value + unit, expected range, status dot, 30 s trend sparkline with the expected band shaded. | LiveTable. |
| LD-202 | Rows MUST be coloured by status from 005 (ok/warn/bad/na), with the reason shown under the expected range. | Inject "vacuum leak" → A/F rows turn yellow/red. |
| LD-203 | Show the detected engine condition and a summary count of out-of-range values in the header. | Status bar. |
| LD-204 | Unverified registers are tagged "unverified". | Tag visible. |
| LD-205 | Digital registers (0x13, 0x1E, 0x1F) show as 8 bit-lamps + hex, with a note that labels are unknown. | BitsPanel. |
| LD-206 | UI refresh MUST be throttled (≤5 renders/s) independent of frame rate. | `UI_REFRESH_MS = 200`. |
| LD-207 | Layout MUST work from 360 px wide to desktop; dark mode follows the system. | CSS media queries. |
| LD-208 | Every form field MUST have a `name` and every control an accessible label (Chrome DevTools reports no form-field issues). | `test/formFields.test.tsx`. |

### UI text (LD-4xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| LD-401 | UI strings MUST live in one typed object (`src/ui/messages/`); car data texts (param labels, bit labels, fault code names and hints, range notes) live next to their definitions; diagnosis texts in `src/analysis/diagnosis/`. CONSULT monitor names match the FSM. | `tsc`. |
| LD-402 | The protocol and analysis layers MUST NOT produce UI text for progress and known failures: they emit structured progress events and error codes, and the UI turns them into messages. Unknown errors are shown verbatim. | `test/ui.test.tsx › "LD-402…"`. |
| LD-403 | Machine formats stay independent of UI text: CSV uses param ids and `.` decimals; the traffic log is raw hex. | CSV test. |

## Open questions
- [ ] Bit labels for 0x13/0x1E/0x1F → car session: toggle A/C, P/N, throttle, watch bits.
- [ ] Gauges view for driving (backlog).

## Traceability
| ID | Code | Test |
|---|---|---|
| LD-101..105 | `src/protocol/session/`, `src/ui/App/` | `test/simulator.test.ts` "Session…" |
| LD-201..207 | `src/ui/components/LiveTable/`, `src/ui/components/Sparkline/`, `src/ui/styles/global.css` | `test/ui.test.tsx` (render smoke), manual |
| LD-401..403 | `src/ui/messages/`, `src/ui/messages/`, `src/protocol/session/ › Progress`, `ConsultError.code` | `test/ui.test.tsx`, CSV tests in `test/analysis.test.ts` |
