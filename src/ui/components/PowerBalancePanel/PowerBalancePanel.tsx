import { useEffect, useRef, useState } from "react";

import type { CutMeasurement, PowerBalanceResult } from "@/analysis/power-balance";
import { checkInterlocks } from "@/analysis/power-balance";
import { downloadText, timestampForFile } from "@/logging/csv";
import { cylinderStore, powerBalanceCsv } from "@/logging/cylinder-store";
import type { PbPhase } from "@/protocol/power-balance-runner";
import { PowerBalanceRunner } from "@/protocol/power-balance-runner";
import { createCx } from "@/ui/lib";
import { fmt, m } from "@/ui/messages";

import { Bars } from "./Bars";
import styles from "./PowerBalancePanel.module.css";
import type { PowerBalancePanelProps } from "./types";

const cx = createCx(styles);

/** CY-401..403: power balance test UI with interlocks, live progress and results. */
export function PowerBalancePanel({ session, connected, isEngine, onResult }: PowerBalancePanelProps) {
  const t = m.cyl;
  const [dryRun, setDryRun] = useState(() => !cylinderStore.fullRunDone());
  const [rounds, setRounds] = useState(1);
  const [odometer, setOdometer] = useState("");
  const [phase, setPhase] = useState<PbPhase | null>(null);
  const [live, setLive] = useState<CutMeasurement[]>([]);
  const [history, setHistory] = useState<PowerBalanceResult[]>(() => cylinderStore.powerBalance());
  const runner = useRef<PowerBalanceRunner | null>(null);
  const running = phase !== null && phase.kind !== "done";
  const [, tick] = useState(0);

  // CY-401: live rpm — the app's refresh timer pauses while the test holds the ECU, so refresh here.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 200);
    return () => clearInterval(id);
  }, [running]);

  // CY-204 / CY-102: stop when the tab is hidden; best-effort restore when it closes.
  useEffect(() => {
    const onHide = () => document.hidden && runner.current?.stop("hidden");
    const onUnload = () => {
      runner.current?.stop("hidden");
      runner.current?.emergencyRestore();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  const { blocked, warnings } = checkInterlocks(session.latest, {
    isEngine,
    busy: !connected || running || session.state === "busy",
  });
  const latest = history[0];

  const start = async () => {
    if (!window.confirm(t.confirm(dryRun))) return;
    const km = Number(odometer);
    setLive([]);
    runner.current = new PowerBalanceRunner(
      session,
      { dryRun, rounds, ...(odometer && Number.isFinite(km) ? { odometerKm: km } : {}) },
      { onPhase: setPhase, onCut: (c) => setLive((l) => [...l, c]) },
    );
    try {
      const result = await runner.current.run();
      setHistory(cylinderStore.addPowerBalance(result));
      if (result.dryRun && !result.aborted) setDryRun(false);
      onResult(result);
    } finally {
      runner.current = null;
      setPhase({ kind: "done" });
    }
  };

  const phaseText = (p: PbPhase) =>
    p.kind === "baseline"
      ? t.phase.baseline(p.cylinder, p.round)
      : p.kind === "cut"
        ? t.phase.cut(p.cylinder, p.round)
        : p.kind === "recover"
          ? t.phase.recover(p.cylinder, p.round)
          : p.kind === "restoring"
            ? t.phase.restoring
            : t.phase.done;

  const maxDrop = Math.max(
    60,
    ...(latest?.cylinders ?? []).map((c) => c.dropRpm),
    ...live.map((c) => c.baselineRpm - c.cutRpm),
  );
  const shown = running ? null : latest;

  return (
    <section className={cx("card cyl")}>
      <h2>{t.pbTitle}</h2>
      <p className={cx("small muted")}>{t.pbIntro}</p>

      {shown?.restoreUnconfirmed && <div className={cx("danger-box")}>{t.restoreWarning}</div>}

      <div className={cx("pb-controls")}>
        <label className={cx("chip")}>
          <input
            name="pb-dry-run"
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            disabled={running}
          />
          {t.dryRun}
        </label>
        {!dryRun && (
          <label className={cx("setting")}>
            <span>{t.rounds}</span>
            <select
              name="pb-rounds"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              disabled={running}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </label>
        )}
        <label className={cx("setting")}>
          <span>{t.odometer}</span>
          <input
            name="pb-odometer"
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            disabled={running}
          />
        </label>
      </div>
      {dryRun && <p className={cx("small muted")}>{t.dryRunHint}</p>}

      {!running && blocked.length > 0 && (
        <ul className={cx("interlocks small")}>
          {blocked.map((b) => (
            <li key={b}>{t.interlock[b]}</li>
          ))}
        </ul>
      )}
      {!running && blocked.length === 0 && warnings.includes("not-in-park-neutral") && (
        <p className={cx("small warn-text")}>{t.notInPN}</p>
      )}

      <div className={cx("actions")}>
        {running ? (
          <button className={cx("danger-solid")} onClick={() => runner.current?.stop("user")}>
            {t.stop}
          </button>
        ) : (
          <button className={cx("primary")} onClick={() => void start()} disabled={blocked.length > 0}>
            {t.start}
          </button>
        )}
      </div>
      {phase && (
        <p className={cx("small pb-phase")}>
          {phaseText(phase)}
          {running && session.latest.rpm !== undefined && ` · ${fmt(session.latest.rpm, 0)} ${m.unit.rpm ?? "rpm"}`}
        </p>
      )}

      {running && live.length > 0 && (
        <Bars
          rows={live.map((c) => ({ cylinder: c.cylinder, drop: c.baselineRpm - c.cutRpm, status: "na" as const }))}
          max={maxDrop}
          label={t.cylinder}
        />
      )}

      {shown && (
        <div className={cx("pb-result")}>
          <div className={cx("small muted")}>{t.resultHeader(new Date(shown.date).toLocaleString(), shown.mode)}</div>
          {shown.aborted && <p className={cx("small warn-text")}>{t.abort[shown.aborted]}</p>}
          {shown.dryRun && !shown.aborted && <p className={cx("small ok-text")}>{t.dryRunDone}</p>}
          {!shown.dryRun && shown.inconclusive && <p className={cx("small warn-text")}>{t.inconclusive}</p>}
          <Bars
            rows={shown.cylinders.map((c) => ({
              cylinder: c.cylinder,
              drop: c.dropRpm,
              status: c.status,
              pct: c.dropPct,
              ...(c.aacRise !== undefined ? { aacRise: c.aacRise } : {}),
            }))}
            max={maxDrop}

            label={t.cylinder}
            statusText={t.status}
            aacLabel={t.aacRise}
          />
          {!shown.dryRun && !shown.inconclusive && !shown.aborted && (
            <p className={cx("small")}>
              {shown.cylinders.some((c) => c.status !== "ok")
                ? `${t.weak(
                    shown.cylinders
                      .filter((c) => c.status !== "ok")
                      .map((c) => c.cylinder)
                      .join(", "),
                  )}. ${t.nextSteps}`
                : t.allOk}
            </p>
          )}
        </div>
      )}
      {history.length > 1 && (
        <details className={cx("small pb-history")}>
          <summary>
            {t.history} ({history.length})
          </summary>
          <ul>
            {history.slice(0, 10).map((r) => {
              const weak = r.cylinders.filter((c) => c.status !== "ok").map((c) => c.cylinder);
              return (
                <li key={r.date}>
                  {new Date(r.date).toLocaleString()}
                  {r.odometerKm !== undefined && ` · ${fmt(r.odometerKm, 0)} ${m.unit.km ?? "km"}`} ·{" "}
                  {r.aborted
                    ? t.abort[r.aborted]
                    : r.dryRun
                      ? t.dryRun
                      : r.inconclusive
                        ? t.inconclusive
                        : weak.length
                          ? t.weak(weak.join(", "))
                          : t.allOk}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {history.length > 0 && (
        <div className={cx("actions")}>
          <button
            className={cx("link")}
            onClick={() => downloadText(`power-balance-${timestampForFile()}.csv`, powerBalanceCsv(history))}
          >
            {t.exportCsv} ({history.length})
          </button>
        </div>
      )}
    </section>
  );
}
