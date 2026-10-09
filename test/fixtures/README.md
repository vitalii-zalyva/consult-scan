# Fixtures

Byte logs in `W <hex>` (host → ECU) / `R <hex>` (ECU → host) format, replayed by `test/helpers/replayTransport.ts`.

| File | Source | ECU |
|---|---|---|
| `openconsult-log_01.txt` | [jonsim/openconsult](https://github.com/jonsim/openconsult) `logs/log_01.txt` (GPLv3 project) | JDM RB-series, not the A32 |

Add real A32 VQ30DE captures here as `a32-vq30de-<date>.txt` (from the app's "Save traffic log"), see the `car-test-session` skill.
