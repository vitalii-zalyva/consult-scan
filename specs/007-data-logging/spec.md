# 007 — Data logging

- **Status:** implemented
- **Prefix:** LOG
- **Related:** 004, 002 (TR-003)

## Requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| LOG-101 | "Record CSV" collects every sample until stopped, then downloads `consult-<timestamp>.csv`. | Button toggles; file downloads. |
| LOG-102 | CSV: header `time_s,<id> [unit],…`, time relative to first sample (3 decimals), values with the param's display precision, empty cell for missing. | "LOG-1xx: CSV" test. |
| LOG-201 | "Save traffic log" downloads the raw `W <hex>` / `R <hex>` lines (last 4000), first line `# <ISO time> <device>`. Same format as `test/fixtures`. | Downloaded file replays with `ReplayTransport`. |
| LOG-202 | Keep at most 15 000 samples in memory for trends/checks (~10 min). | `HISTORY_LIMIT`. |

## Backlog
- Load a CSV for offline review (replay mode).
- Timestamps in the traffic log.

## Traceability
| ID | Code | Test |
|---|---|---|
| LOG-101..102 | `src/logging/csv/`, `src/ui/App/` | "LOG-1xx: CSV" |
| LOG-201..202 | `src/ui/App/`, `src/protocol/session/` | manual |
