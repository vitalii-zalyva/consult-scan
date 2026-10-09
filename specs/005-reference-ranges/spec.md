# 005 — Reference ranges & checks (VQ30DE)

- **Status:** implemented — **all ranges `verified: false`** until checked against the FSM and the car
- **Prefix:** RR
- **Related:** 004

## Context
FSM section EC lists "CONSULT reference values in data monitor mode". They depend on the engine condition
(e.g. MAF 1.0–1.7 V at idle but 1.5–2.1 V at 2000 rpm), so ranges are keyed by a detected condition.

## Requirements

### Condition detection (RR-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RR-101 | Classify each sample: engine-off (<50 rpm), cranking (<400), driving (>3 km/h), cold (coolant <70 °C), warm-idle (<1000 rpm), warm-2000 (1800–2200 rpm), warm-other. | `test/analysis.test.ts` table. |

### Range table (RR-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RR-201 | Each rule: param, conditions (empty = always), min/max, FSM-worded note, `verified` flag. | `VQ30DE_RULES`. |
| RR-202 | Initial VQ30DE table (below) MUST be shipped and marked unverified. | — |

| Param | Condition | Range | Note / source |
|---|---|---|---|
| rpm | warm idle | 575–800 | Idle 625±50 M/T, 700±50 A/T (N) — FSM EC basic inspection |
| MAF | key on, engine off | 0.2–0.5 V | |
| MAF | warm idle | 1.0–1.7 V | FSM ref. values |
| MAF | 2000 rpm | 1.5–2.1 V | FSM ref. values |
| Coolant | always / warm | −40–105 / 70–100 °C | overheat guard / "after warm-up" |
| Battery | engine off / running | 11.8–13.0 / 13.2–14.8 V | FSM lists 11–14 V; charging norm used |
| TPS | closed throttle | 0.35–0.65 V | FSM ref. values |
| TPS | always | 0.2–4.8 V | circuit sanity |
| Injection pulse | warm idle / 2000 rpm | 2.4–3.2 / 1.9–2.8 ms | FSM ref. values |
| Ignition timing | warm idle / 2000 rpm | 13–17 / 25–45 ° BTDC | 15±2° idle |
| IACV-AAC | warm idle | 20–40 % | FSM ref. values |
| A/F alpha | warm idle, 2000 rpm | 75–125 % | FSM ref. values |
| Self-learn | always | 80–120 % | heuristic |
| O2 sensors | always | 0–1.1 V | sensor range |

### Evaluation (RR-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RR-301 | Status per value: `ok` inside every applicable range, `na` when no rule applies. | Tests. |
| RR-302 | Outside by ≤10 % of the range width → `warn`; further → `bad`. | Timing 17.3° at idle → warn; 5° → bad. |
| RR-303 | Worst status across applicable rules wins; the failing rule's note is the explanation. | — |

### History checks (RR-4xx)

> In the UI these are now shown through the diagnosis block (011: DX-201/203/205). `historyFindings` remains as the tested reference implementation.

| ID | Requirement | Acceptance criterion |
|---|---|---|
| RR-401 | Front O2: over a steady 10 s warm window, fewer than 6 lean↔rich cycles (threshold 0.45 V) → finding: `bad` at 2000 rpm, `warn` at idle. | 0.1 Hz → flagged; 1.2 Hz → clean. |
| RR-402 | A/F alpha >115 % with self-learn >110 % → "running lean" finding; <85 % with <90 % → "running rich". | Lean test. |

## Open questions
- [ ] Transcribe the actual FSM EC table for the user's market/year (US vs EU A32 differ) → user to provide FSM pages or a photo; then set `verified: true` per rule.
- [ ] M/T or A/T? Narrows the idle-speed rule.
- [ ] Is "cycles" (our interpretation) or "transitions" what the FSM means by "changes more than 5 times"?

## Traceability
| ID | Code | Test |
|---|---|---|
| RR-1xx | `src/analysis/conditions/` | "RR-1xx: condition detection" |
| RR-2xx | `src/analysis/reference-ranges/` | "RR-3xx" uses the table |
| RR-3xx | `src/analysis/evaluate/ › evaluateValue, rulesFor` | "RR-3xx: range evaluation" |
| RR-4xx | `evaluate.ts › historyFindings` | "RR-401", "RR-402" |
