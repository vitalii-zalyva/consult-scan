# 013 — A32 register map corrections (first car session)

- **Status:** implemented (approval delegated by the user, 2026-10-13: "find everything; decide yourself what is right and what is not")
- **Prefix:** RC
- **Related:** 004 (display, LD-204 "unverified" tag), 005 (reference ranges), 008 (PLMS register map), 010 (fuel, FU-105), 011 (diagnosis)

## Context
First real-car recordings (ECU **23710-44U01, ROM 048A**, 2026-10-13) show that several registers taken from the
PLMS generic table (spec 008) do not decode to physically possible values on this ECU. The app currently paints
them red against reference ranges, counts them in "Out of range", and uses one of them (MAF g/s) for a derived fuel
figure — so the user sees false alarms that look like car faults. This spec marks those registers as **suspect** for
this ECU, keeps their raw bytes visible for later decoding, and stops every check and derived value that depends on them.
Where a source documents this car's register (PLMS list for the A32 VQ30DE) **and** the car data agrees, the decoder is
corrected instead (RC-4xx). Registers with no documented meaning stay suspect.

## Evidence

Files: `consult-2026-10-13T17-42-15.csv` (key on, engine off, 28 s) and `consult-2026-10-13T17-51-16.csv`
(warm idle 925–1013 rpm, coolant 79–82 °C, stationary, 66 s, 1991 samples).

| Param (reg) | Engine off | Warm idle | Why it is implausible |
|---|---|---|---|
| `mafGs` MASS AIRFLOW (0x38) | 0 | **1 g/s constant** | A 3.0 L engine at ~950 rpm needs ~3–5 g/s; MAF voltage (0x04/05) reads a normal 1.22 V and injection is normal. |
| `baseFuel` B/FUEL SCHDL (0x34) | 1.99 ms | **0.00–2.55 ms, spread over the whole byte range** at steady idle | A steady-state calculated value cannot jump randomly; looks like the low byte of a 16-bit value or a different quantity. |
| `rpmRef` CKPS·RPM REF (0x02/03) | 0 | **19 752–25 808 rpm** while POS rpm = 763–1013 | Wrong register or scaling for this ECU. |
| `wastegate` WASTE GATE SOL (0x28) | 0 | **180 % constant** | VQ30DE has no turbo; value > 100 %. |
| `o2HeaterB1` / `o2HeaterB2` (0x30/0x31) | 8 / 128 | **104 / 128 constant** | Decoded as on/off but the bytes are not 0/1 and differ between banks without changing. |

Registers **not** marked suspect (look plausible, or are a possible real car fault): `o2Rh` (0x0A, constant 0.32 V —
possible real bank 2 fault or missing sensor, see open questions), `afAlphaRh`, `afLearnRh`, `timing`, `bits13`, `evapPressure`.

## Requirements

### Suspect registers (RC-1xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RC-101 | The app MUST keep a per-ECU list of **suspect** params: `{ partNumber prefix, param id, reason, evidence (file + date) }`. List for `23710-44U01`: `wastegate` (0x28), `o2HeaterB1`/`o2HeaterB2` (0x30/0x31). The other three rows of the evidence table are corrected by RC-401..403. | Lookup with `"23710-44U01 (ROM 048A)"` returns the 3 params; with `"23710-0A503 (ROM …)"` or the simulator's part number returns none. |
| RC-102 | Matching MUST use the part number without the ROM suffix (`23710-44U01`), so other ROM revisions of the same ECU are covered. | `"23710-44U01 (ROM 0499)"` → same 3 params. |
| RC-103 | A suspect param MUST still be streamed, shown in the live table with its raw hex bytes (XD-102), and exported to CSV unchanged. | Row present, raw bytes visible, CSV column present. |
| RC-104 | A suspect param row MUST show a **"suspect"** tag instead of the "unverified" tag, with the reason as tooltip, and its value MUST be rendered muted, never red/amber. | Given 23710-44U01 and `wastegate = 180` → row shows tag, no out-of-range colour. |
| RC-105 | Reference-range rules (spec 005) MUST NOT be evaluated for suspect params: no range shown, not counted in the "Out of range" header counter. | Suspect params get status `na`. |
| RC-106 | Diagnosis rules (spec 011) and derived values MUST NOT use suspect params. | None of `wastegate`, `o2HeaterB1/B2` is read by `src/analysis/diagnosis/` or `src/analysis/fuel/`. |
| RC-107 | With no part number (not yet read) or any other ECU the behaviour MUST be exactly as before this spec. | Existing tests pass unchanged; simulator shows no "suspect" tags. |

### Reference data (RC-2xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RC-201 | The two car CSVs above MUST be added as fixtures (`test/fixtures/a32-vq30de-2026-10-13-engine-off.csv`, `…-warm-idle.csv`) and a test MUST replay the warm-idle file through evaluation with part number 23710-44U01 and assert no out-of-range result for any suspect param. | `test/registerCorrections.test.tsx › "RC-201: …"`. |
| RC-202 | Spec 008's register table MUST get a note linking to this spec for the 6 params. | Note present in `specs/008-extended-data/spec.md`. |

### Texts (RC-3xx)
| ID | Requirement | Acceptance criterion |
|---|---|---|
| RC-301 | Tag text, tooltip and each reason MUST be present in `src/ui/messages/` / the suspect list. | `src/ui/messages/` has `suspect`/`suspectTitle`; each list entry has a `reason`. |

### A32 decoders (RC-4xx)
Source: PLMS, *1999 Nissan Maxima A32 VQ30DE (USA OBD2) register list* — https://www.plmsdevelopments.com/files/1999_a32_maxima_obd2_registers.pdf — each cross-checked against the 2026-10-13 warm-idle recording.

| ID | Requirement | Acceptance criterion |
|---|---|---|
| RC-401 | `rpmRef` (0x02/0x03) MUST decode as `2 494 000 / u16` (0 → 0) — the register holds a period, not a speed. Marked verified. | Car: raw ≈ 2632 → 948 rpm vs POS 925–975 rpm; every sample within 5 % of POS. |
| RC-402 | 0x34 is the fractional part of CAL/LD, not B/FUEL SCHDL: `calLoad` MUST read 0x33 + 0x34 and decode `0x33 + 0x34/255` %. The `baseFuel` param and its reference range MUST be removed (no B/FUEL register is documented). | Car: 19.1–19.5 % at steady idle instead of "0–2.55 ms random". |
| RC-403 | 0x38 MUST be shown as `mafPct`, "Mass air flow (% of max)", unit %, 1 % steps. The g/s param `mafGs`, its g/s ranges, and the MAF-based fuel cross-check (FU-105) MUST be removed: 1 % ≈ 2.7 g/s (PLMS estimate of full scale) is too coarse at idle. | Car: raw 1 → 1 %. |
| RC-404 | Non-linear decoders MUST provide an `encode` inverse so the simulator still produces byte-accurate frames (SIM). | `decode(encode(v)) ≈ v` for `rpmRef`, `calLoad`. |


## Out of scope
- **New scalings** for 0x28, 0x30, 0x31 — only after a source or a deep-scan traffic log documents them.
- Fault-code interpretation: decided in spec 006 (FC-101 revised, 2026-10-13).
- Changing reference ranges for timing / injection pulse / idle rpm: these may be real car findings, not app errors.
- Any ECU write. This spec only changes display and analysis of data that is already being read.

## Safety
No change to the command set: only the existing read commands are sent. Nothing in this spec talks to the ECU.

## Open questions
- [x] Decoding of 0x02/03, 0x34, 0x38 → PLMS A32 list + car data (RC-401..403).
- [ ] Meaning of 0x28, 0x30, 0x31 on 23710-44U01 → no source found; deep scan + traffic log.
- [ ] Deep scan (2026-10-13 18:31) found undocumented 0x18 (raw 26–27, tracks IGN TIMING 26–28° — maybe a second timing value), 0x20, 0x2B, 0x2C (0 at idle) → watch at 2000 rpm.
- [x] RC-401/402 confirmed on a second recording (`a32-vq30de-2026-10-13-warm-idle-2.csv`): REF 937–1017 rpm vs POS 925–1025; CAL/LD 18.9–20.1 % smooth.
- [x] Why the car differs from the PLMS (US) A32 list (`FF FF EF` init, no 0x35 / 0x10): it is a European ECU (user, 2026-10-13). Other registers from that list are not taken over without car data.
- [ ] **Bank 2 front O2 (0x0A) constant 0.32 V, A/F alpha/learn bank 2 constant 100 %, bank 2 lean bit (0x21 bit 6) never toggles.** The sensor **is fitted** (user, 2026-10-13). Remaining: register 0x0A wrong on this ECU, or sensor/heater/wiring fault → research + sensor voltage check at the connector.
- [ ] Idle timing 21–28° BTDC (avg 26) at 79–82 °C vs 15±2° (2001 VQ30DE tune-up table, not an A32 FSM) → timing light check.
- [ ] 0x13 bit 0 (closed throttle) is never set at idle; PLMS A32 list says the ECU's closed-throttle state is in 0x4B, and bit 7 (set with key on) is unlabelled → read 0x4B / press pedal slowly with key on.
- [x] Market of ECU 23710-44U01 → **European** (Maxima QX A32; user, 2026-10-13). Pre-EOBD, so US OBD-II sources (incl. the PLMS A32 list) apply only where the car data confirms them (RC-401..403 are confirmed).

## Traceability
| ID | Code | Test |
|---|---|---|
| RC-101..102 | `src/analysis/suspect-registers/ › SUSPECT_REGISTERS, ecuBase, suspectParams` | `test/registerCorrections.test.tsx › "RC-101…", "RC-102…"` |
| RC-103..104 | `src/ui/components/LiveTable/` (`st-suspect`, tag), `src/ui/styles/global.css` | `… › "RC-103/104…"` |
| RC-105 | `suspectRegisters.ts › rulesWithout`, `src/ui/App/` (rules → evaluateAll, LiveTable) | `… › "RC-105…"` |
| RC-106 | diagnosis (011) and fuel (010) read none of the suspect params | code review |
| RC-107 | `suspectParams` returns empty map | `… › "RC-107…"` + all earlier tests unchanged |
| RC-201 | `test/fixtures/a32-vq30de-2026-10-13-*.csv` | `… › "RC-201…"` |
| RC-202 | `specs/008-extended-data/spec.md` note | — |
| RC-301 | `src/ui/messages/ › suspect, suspectTitle`; `reason` | `… › "RC-301…"` |
| RC-401..404 | `src/protocol/registers/` (`rpmRef`, `calLoad`, `mafPct`, `encode`), `src/simulator/fake-ecu/ › encodeParam`, `src/simulator/engine-model/`, `src/analysis/reference-ranges/` | `… › "RC-401…"`, `"RC-402…"`, `"RC-403…"`, `"RC-401/402: simulator encoders…"` |
