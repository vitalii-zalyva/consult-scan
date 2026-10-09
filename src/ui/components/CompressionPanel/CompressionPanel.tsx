import { useState } from "react";

import type { CompressionEntry, CompressionHint, CompressionSpec, PressureUnit } from "@/analysis/compression";
import {
  compressionHints,
  evaluateCompression,
  fromKpa,
  latestPair,
  PRESSURE_UNITS,
  toKpa,
  UNIT_DIGITS,
} from "@/analysis/compression";
import { downloadText, timestampForFile } from "@/logging/csv";
import { compressionCsv, cylinderStore } from "@/logging/cylinder-store";
import { createCx } from "@/ui/lib";
import { fmt, m, unitLabel } from "@/ui/messages";

import styles from "./CompressionPanel.module.css";
import { UNIT_KEY } from "./constants";
import { loadUnit } from "./storage";

const cx = createCx(styles);

/** CY-5xx: manual compression entries, evaluation against spec, history. */
export function CompressionPanel({
  onChange,
}: {
  onChange: (entries: CompressionEntry[], spec: CompressionSpec) => void;
}) {
  const t = m.cyl;
  const [entries, setEntries] = useState<CompressionEntry[]>(() => cylinderStore.compression());
  const [spec, setSpecState] = useState<CompressionSpec>(() => cylinderStore.spec());
  const [unit, setUnitState] = useState<PressureUnit>(loadUnit);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [readings, setReadings] = useState<string[]>(() => Array<string>(6).fill(""));
  const [warm, setWarm] = useState(true);
  const [wet, setWet] = useState(false);
  const [odometer, setOdometer] = useState("");
  const [cranking, setCranking] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSpec, setShowSpec] = useState(false);

  const u = unitLabel(unit);
  const show = (kpa: number) => fmt(fromKpa(kpa, unit), UNIT_DIGITS[unit]);
  const setUnit = (x: PressureUnit) => {
    setUnitState(x);
    try {
      localStorage.setItem(UNIT_KEY, x);
    } catch {
      /* storage unavailable */
    }
  };
  const setSpec = (s: CompressionSpec) => {
    setSpecState(s);
    cylinderStore.setSpec(s);
    onChange(entries, s);
  };

  const save = () => {
    const parsed = readings.map((r) => (r.trim() === "" ? null : Number(r.replace(",", "."))));
    if (parsed.every((x) => x === null || !Number.isFinite(x))) {
      setError(t.invalid);
      return;
    }
    const entry: CompressionEntry = {
      id: `${Date.now()}`,
      date: new Date(`${date}T12:00:00`).toISOString(),
      warm,
      wet,
      readingsKpa: parsed.map((x) => (x === null || !Number.isFinite(x) ? null : Math.round(toKpa(x, unit)))),
      ...(odometer ? { odometerKm: Number(odometer) } : {}),
      ...(cranking ? { crankingRpm: Number(cranking) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const all = cylinderStore.addCompression(entry);
    setEntries(all);
    setReadings(Array<string>(6).fill(""));
    setError(null);
    onChange(all, spec);
  };

  const remove = (id: string) => {
    const all = cylinderStore.removeCompression(id);
    setEntries(all);
    onChange(all, spec);
  };

  const { dry, wet: wetEntry } = latestPair(entries);
  const dryEval = dry ? evaluateCompression(dry, spec) : undefined;
  const hints = dryEval ? compressionHints(dryEval, wetEntry ? evaluateCompression(wetEntry, spec) : undefined) : [];
  const hintText = (h: CompressionHint) =>
    h.kind === "rings"
      ? t.hint.rings(h.cylinder)
      : h.kind === "valves"
        ? t.hint.valves(h.cylinder)
        : t.hint.headGasket(h.cylinders[0], h.cylinders[1]);

  const specInput = (key: keyof CompressionSpec, label: string) => (
    <label className={cx("setting")}>
      <span>{label}</span>
      <input
        name={`compression-spec-${key}`}
        type="number"
        value={spec[key]}
        onChange={(e) => Number(e.target.value) > 0 && setSpec({ ...spec, [key]: Number(e.target.value) })}
      />
    </label>
  );

  return (
    <section className={cx("card cyl")}>
      <h2>{t.compTitle}</h2>
      <p className={cx("small muted")}>{t.compIntro}</p>

      <div className={cx("comp-form")}>
        <label className={cx("setting")}>
          <span>{t.date}</span>
          <input name="compression-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className={cx("setting")}>
          <span>{t.pressureUnit}</span>
          <select name="compression-unit" value={unit} onChange={(e) => setUnit(e.target.value as PressureUnit)}>
            {PRESSURE_UNITS.map((x) => (
              <option key={x} value={x}>
                {unitLabel(x)}
              </option>
            ))}
          </select>
        </label>
        <div className={cx("comp-readings")}>
          {readings.map((r, i) => (
            <label key={i}>
              <span>{t.cylinder(i + 1)}</span>
              <input
                name={`compression-cyl-${i + 1}`}
                inputMode="decimal"
                value={r}
                placeholder={u}
                onChange={(e) => setReadings((rs) => rs.map((x, j) => (j === i ? e.target.value : x)))}
              />
            </label>
          ))}
        </div>
        <div className={cx("chips")}>
          <label className={cx("chip")}>
            <input name="compression-warm" type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} />
            {t.warm}
          </label>
          <label className={cx("chip")}>
            <input name="compression-wet" type="checkbox" checked={wet} onChange={(e) => setWet(e.target.checked)} />
            {t.wet}
          </label>
        </div>
        <label className={cx("setting")}>
          <span>{t.odometer}</span>
          <input
            name="compression-odometer"
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
          />
        </label>
        <label className={cx("setting")}>
          <span>{t.cranking}</span>
          <input
            name="compression-cranking"
            type="number"
            value={cranking}
            onChange={(e) => setCranking(e.target.value)}
          />
        </label>
        <label className={cx("setting")}>
          <span>{t.notes}</span>
          <input name="compression-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className={cx("actions")}>
          <button className={cx("primary")} onClick={save}>
            {t.save}
          </button>
          <button className={cx("link")} onClick={() => setShowSpec((x) => !x)}>
            {t.specTitle}
          </button>
        </div>
        {error && <p className={cx("small warn-text")}>{error}</p>}
        {showSpec && (
          <div className={cx("settings")}>
            {specInput("standardKpa", t.specStandard)}
            {specInput("minimumKpa", t.specMinimum)}
            {specInput("maxDiffKpa", t.specMaxDiff)}
            <p className={cx("small muted")}>{t.specNote}</p>
          </div>
        )}
      </div>

      {hints.length > 0 && (
        <ul className={cx("small comp-hints")}>
          {hints.map((h, i) => (
            <li key={i}>{hintText(h)}</li>
          ))}
        </ul>
      )}

      {entries.length === 0 ? (
        <p className={cx("muted small")}>{t.noResults}</p>
      ) : (
        <div className={cx("comp-table-wrap")}>
          <table className={cx("data comp-table")}>
            <thead>
              <tr>
                <th>{t.date}</th>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <th key={c} className={cx("num")}>
                    {c}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const ev = evaluateCompression(e, spec);
                return (
                  <tr key={e.id}>
                    <td className={cx("small")}>
                      {e.date.slice(0, 10)} · {e.wet ? t.wetLabel : t.dryLabel}
                      <div className={cx("muted")}>{t.spread(`${show(ev.spreadKpa)} ${u}`)}</div>
                    </td>
                    {ev.cylinders.map((c) => (
                      <td
                        key={c.cylinder}
                        className={cx(`num st-${c.status}`)}
                        title={c.reasons.map((r) => t.reason[r]).join(", ")}
                      >
                        {c.kpa === null ? "—" : show(c.kpa)}
                      </td>
                    ))}
                    <td>
                      <button className={cx("link")} onClick={() => remove(e.id)} title={t.remove}>
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button
            className={cx("link")}
            onClick={() => downloadText(`compression-${timestampForFile()}.csv`, compressionCsv(entries))}
          >
            {t.exportCsv}
          </button>
        </div>
      )}
    </section>
  );
}
