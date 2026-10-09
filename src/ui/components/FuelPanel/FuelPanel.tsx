import { useState } from "react";

import { detectCondition } from "@/analysis/conditions";
import type { FuelSettings } from "@/analysis/fuel";
import { fuelRate, MIN_CALIBRATION_LITRES, tripAverage } from "@/analysis/fuel";
import { createCx } from "@/ui/lib";
import { fmt, m } from "@/ui/messages";

import { IDLE_PLAUSIBLE_LH } from "./constants";
import styles from "./FuelPanel.module.css";
import type { FuelPanelProps } from "./types";

const cx = createCx(styles);

/** FU-401/402: derived fuel consumption, trip and calibration. */
export function FuelPanel({ values, trip, settings, onReset, onCalibrate, onSettings }: FuelPanelProps) {
  const t = m.fuel;
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rate = fuelRate(values, settings);
  const avg = tripAverage(trip);
  const condition = detectCondition(values);
  const implausible =
    condition === "warm-idle" &&
    (rate.litresPerHour < IDLE_PLAUSIBLE_LH[0] || rate.litresPerHour > IDLE_PLAUSIBLE_LH[1]);
  const mafDiff =
    rate.mafLitresPerHour !== undefined && rate.litresPerHour > 0.05
      ? ((rate.mafLitresPerHour - rate.litresPerHour) / rate.litresPerHour) * 100
      : undefined;
  const lh = m.unit["L/h"] ?? "L/h";
  const l100 = m.unit["L/100 km"] ?? "L/100 km";
  const l = m.unit["L"] ?? "L";
  const km = m.unit["km"] ?? "km";

  const calibrate = () => {
    const answer = window.prompt(t.calibratePrompt(fmt(trip.litres, 2)));
    if (answer === null) return;
    setError(onCalibrate(Number(answer.replace(",", "."))));
  };

  const num = (key: keyof FuelSettings, label: string, step: number) => (
    <label className={cx("setting")}>
      <span>{label}</span>
      <input
        name={`fuel-${key}`}
        type="number"
        step={step}
        value={settings[key]}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 0) onSettings({ ...settings, [key]: v });
        }}
      />
    </label>
  );

  const minutes = Math.floor(trip.durationMs / 60_000);

  return (
    <section className={cx("card fuel")}>
      <div className={cx("card-head")}>
        <h2>{t.title}</h2>
        <span className={cx("tag")} title={t.calculatedTitle}>
          {t.calculated}
        </span>
      </div>
      <div className={cx("fuel-big")}>
        <div>
          <span className={cx("val")}>{fmt(rate.litresPerHour, 2)}</span>
          <span className={cx("unit")}>{lh}</span>
        </div>
        <div>
          <span className={cx("val")}>{rate.litresPer100km === undefined ? "—" : fmt(rate.litresPer100km, 1)}</span>
          <span className={cx("unit")}>{l100}</span>
        </div>
      </div>
      {rate.mafLitresPerHour !== undefined && (
        <p className={cx("small muted")}>
          {t.mafCheck(
            fmt(rate.mafLitresPerHour, 2),
            mafDiff === undefined ? "" : ` (${mafDiff >= 0 ? "+" : ""}${fmt(mafDiff, 0)} %)`,
          )}
        </p>
      )}
      {implausible && <p className={cx("small warn-text")}>{t.implausible}</p>}

      <div className={cx("trip")}>
        <div>
          <b>{fmt(trip.litres, 2)}</b> {l}
        </div>
        <div>
          <b>{fmt(trip.km, 1)}</b> {km}
        </div>
        <div>
          <b>{avg === undefined ? "—" : fmt(avg, 1)}</b> {l100}
        </div>
        <div className={cx("muted")}>{t.duration(Math.floor(minutes / 60), minutes % 60)}</div>
      </div>
      <div className={cx("actions")}>
        <button onClick={onReset}>{t.resetTrip}</button>
        <button
          onClick={calibrate}
          disabled={trip.litres < MIN_CALIBRATION_LITRES}
          title={t.calibrateAvailableAfter(MIN_CALIBRATION_LITRES)}
        >
          {t.calibrate}
        </button>
        <button className={cx("link")} onClick={() => setShowSettings((x) => !x)}>
          {showSettings ? t.hideSettings : t.settings}
        </button>
      </div>
      {error && <p className={cx("small warn-text")}>{error}</p>}
      {showSettings && (
        <div className={cx("settings")}>
          {num("injectorCcMin", t.injector, 1)}
          {num("deadTime14Ms", t.deadTime, 0.05)}
          {num("deadTimeSlopeMsPerV", t.deadTimeSlope, 0.01)}
          {num("calibration", t.calibration, 0.01)}
          <p className={cx("small muted")}>{t.settingsNote}</p>
        </div>
      )}
    </section>
  );
}
