# Fixtures

Byte logs in `W <hex>` (host → ECU) / `R <hex>` (ECU → host) format, replayed by `test/helpers/replayTransport.ts`.

| File | Source | ECU |
|---|---|---|
| `a32-vq30de-2026-10-13-engine-off.csv` | App CSV export, user's car, key on / engine off, 28 s | A32 VQ30DE, 23710-44U01 (ROM 048A) |
| `a32-vq30de-2026-10-13-warm-idle.csv` | App CSV export, user's car, warm idle 79–82 °C, 66 s | A32 VQ30DE, 23710-44U01 (ROM 048A) |
| `a32-vq30de-2026-10-13-warm-idle-2.csv` | App CSV export after spec 013 decoders + deep scan, warm idle 82 °C, 75 s | A32 VQ30DE, 23710-44U01 (ROM 048A) |
| `openconsult-log_01.txt` | [jonsim/openconsult](https://github.com/jonsim/openconsult) `logs/log_01.txt` (GPLv3 project) | JDM RB-series, not the A32 |

Add real A32 VQ30DE captures here as `a32-vq30de-<date>.txt` (from the app's "Save traffic log"), see the `car-test-session` skill.
