import { useEffect, useRef, useState } from "react";

import { detectCondition } from "@/analysis/conditions";
import { diagnose } from "@/analysis/diagnosis";
import type { Sample } from "@/analysis/evaluate";
import { evaluateAll } from "@/analysis/evaluate";
import type { FuelSettings, TripState } from "@/analysis/fuel";
import { addToTrip, calibrate, DEFAULT_FUEL_SETTINGS, emptyTrip } from "@/analysis/fuel";
import { VQ30DE_RULES } from "@/analysis/reference-ranges";
import { downloadText, timestampForFile, toCsv } from "@/logging/csv";
import type { FaultCodeReading } from "@/protocol/fault-codes";
import type { SessionState } from "@/protocol/session";
import { ConsultSession } from "@/protocol/session";
import type { UnitId } from "@/protocol/units";
import { UNITS } from "@/protocol/units";
import { SimulatorTransport } from "@/transport/simulator";
import type { Transport } from "@/transport/types";
import { WebSerialTransport } from "@/transport/web-serial";
import { WebUsbFtdiTransport } from "@/transport/webusb-ftdi";
import {
  BitsPanel,
  CoveragePanel,
  DiagnosisPanel,
  FaultCodesPanel,
  FuelPanel,
  Intro,
  LiveTable,
  SimulatorPanel,
} from "@/ui/components";
import { createCx } from "@/ui/lib";
import { describeError, describeProgress, m } from "@/ui/messages";

import styles from "./App.module.css";
import {
  FUEL_SETTINGS_KEY,
  FUEL_TRIP_KEY,
  TRAFFIC_LIMIT,
  TREND_WINDOW_MS,
  TRIP_SAVE_MS,
  UI_REFRESH_MS,
} from "./constants";
import { loadJson, restoreDeepScan, saveJson } from "./storage";
import type { Source } from "./types";

const cx = createCx(styles);

export function App() {
  const [source, setSource] = useState<Source>(WebSerialTransport.isSupported() ? "web-serial" : "simulator");
  const [session, setSession] = useState<ConsultSession | null>(null);
  const [state, setState] = useState<SessionState>("disconnected");
  const [message, setMessage] = useState("");
  const [, setTick] = useState(0);
  const [codes, setCodes] = useState<FaultCodeReading[] | null>(null);
  const [recording, setRecording] = useState<Sample[] | null>(null);
  const recordingRef = useRef<Sample[] | null>(null);
  const traffic = useRef<string[]>([]);
  // FU-2xx/3xx: trip and settings live in refs so the sample callback always sees the latest.
  const [fuelSettings, setFuelSettingsState] = useState<FuelSettings>(() =>
    loadJson(FUEL_SETTINGS_KEY, DEFAULT_FUEL_SETTINGS),
  );
  const fuelSettingsRef = useRef(fuelSettings);
  const trip = useRef<TripState>({ ...loadJson(FUEL_TRIP_KEY, emptyTrip()), lastT: undefined });
  const lastTripSave = useRef(0);

  const setFuelSettings = (s: FuelSettings) => {
    fuelSettingsRef.current = s;
    setFuelSettingsState(s);
    saveJson(FUEL_SETTINGS_KEY, s);
  };
  const resetTrip = () => {
    trip.current = emptyTrip();
    saveJson(FUEL_TRIP_KEY, trip.current);
    setTick((n) => n + 1);
  };

  // Throttle React renders; samples arrive at up to ~25 Hz.
  useEffect(() => {
    if (state !== "streaming") return;
    const id = setInterval(() => setTick((n) => n + 1), UI_REFRESH_MS);
    return () => clearInterval(id);
  }, [state]);

  const connect = async () => {
    setMessage("");
    let transport: Transport & { describe(): string };
    try {
      transport =
        source === "simulator"
          ? new SimulatorTransport()
          : source === "web-serial"
            ? await WebSerialTransport.request()
            : await WebUsbFtdiTransport.request();
    } catch (err) {
      setMessage(describeError(err));
      return;
    }
    traffic.current = [`# ${new Date().toISOString()} ${transport.describe()}`];
    transport.onTraffic = (dir, bytes) => {
      const line = `${dir === "tx" ? "W" : "R"} ${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
      traffic.current.push(line);
      if (traffic.current.length > TRAFFIC_LIMIT) traffic.current.splice(1, traffic.current.length - TRAFFIC_LIMIT);
    };
    const s = new ConsultSession(transport, {
      onState: (st, msg) => {
        setState(st);
        if (msg) setMessage(msg);
      },
      onProgress: (p) => setMessage(describeProgress(p)),
      onSample: (sample) => {
        recordingRef.current?.push(sample);
        if (s.unit !== "engine") return;
        addToTrip(trip.current, sample.t, sample.values, fuelSettingsRef.current);
        if (sample.t - lastTripSave.current > TRIP_SAVE_MS) {
          lastTripSave.current = sample.t;
          saveJson(FUEL_TRIP_KEY, { ...trip.current, lastT: undefined });
        }
      },
    });
    setSession(s);
    setCodes(null);
    try {
      await s.connect();
      restoreDeepScan(s);
      setMessage(m.connectedVia(transport.describe()));
      setCodes(await s.readFaultCodes());
      await s.startStreaming();
    } catch (err) {
      setMessage(describeError(err));
    }
  };

  const disconnect = async () => {
    await session?.disconnect();
    setSession(null);
  };

  const toggleRecording = () => {
    if (recordingRef.current) {
      const samples = recordingRef.current;
      recordingRef.current = null;
      setRecording(null);
      if (session && samples.length) {
        downloadText(`consult-${timestampForFile()}.csv`, toCsv(session.params, samples));
      }
    } else {
      recordingRef.current = [];
      setRecording(recordingRef.current);
    }
  };

  const selectUnit = async (unit: UnitId) => {
    if (!session) return;
    try {
      await session.selectUnit(unit);
      restoreDeepScan(session);
      setCodes(await session.readFaultCodes());
    } catch (err) {
      setMessage(describeError(err));
    }
    setTick((n) => n + 1);
  };

  const values = session?.latest ?? {};
  const isEngine = (session?.unit ?? "engine") === "engine";
  const condition = detectCondition(values);
  const evaluations = evaluateAll(values, condition, VQ30DE_RULES);
  const now = Date.now();
  const history = session?.history.filter((s) => s.t >= now - TREND_WINDOW_MS) ?? [];
  const problems = Object.values(evaluations).filter((e) => e?.status === "bad" || e?.status === "warn").length;
  const connected = state === "idle" || state === "streaming" || state === "busy";
  // DX-101: engine-only; codes shown are the engine ECU's while on the engine tab.
  const diagnosis =
    session && connected && isEngine
      ? diagnose({ samples: session.history, latest: values, codes, fuel: fuelSettings })
      : null;
  const sim = session?.transport instanceof SimulatorTransport ? session.transport.ecu : null;

  return (
    <div className={cx("app")}>
      <header className={cx("bar")}>
        <div className={cx("brand")}>
          <strong>Consult Scan</strong>
          <span className={cx("muted")}>{m.subtitle}</span>
        </div>
        <div className={cx("conn")}>
          <select
            name="source"
            aria-label={m.source}
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            disabled={!!session}
          >
            <option value="web-serial" disabled={!WebSerialTransport.isSupported()}>
              {m.sourceSerial}
            </option>
            <option value="web-usb-ftdi" disabled={!WebUsbFtdiTransport.isSupported()}>
              {m.sourceFtdi}
            </option>
            <option value="simulator">{m.sourceSimulator}</option>
          </select>
          {session ? (
            <button onClick={() => void disconnect()}>{m.disconnect}</button>
          ) : (
            <button className={cx("primary")} onClick={() => void connect()}>
              {m.connect}
            </button>
          )}
        </div>
      </header>

      {!WebSerialTransport.isSupported() && <div className={cx("notice")}>{m.noWebSerial}</div>}

      <div className={cx("status")}>
        <span className={cx(`state state-${state}`)}>{m.state[state]}</span>
        {session?.partNumber && <span>{m.ecu(session.partNumber)}</span>}
        {connected && isEngine && <span className={cx("cond")}>{m.condition[condition]}</span>}
        {connected && isEngine && (
          <span className={cx(problems ? "warn-text" : "ok-text")}>
            {problems ? m.outOfReference(problems) : m.allInReference}
          </span>
        )}
        <span className={cx("muted msg")}>{message}</span>
      </div>

      {sim && <SimulatorPanel ecu={sim} />}

      {session && session.availableUnits.length > 1 && (
        <nav className={cx("tabs")} aria-label={m.controlUnit}>
          {session.availableUnits.map((u) => (
            <button
              key={u}
              className={cx(session.unit === u ? "active" : "")}
              onClick={() => void selectUnit(u)}
              disabled={!connected}
            >
              {m.units[u]}
            </button>
          ))}
        </nav>
      )}

      {diagnosis && <DiagnosisPanel diagnosis={diagnosis} />}

      <main className={cx("grid")}>
        <div className={cx("col-main")}>
          {session && session.params.length > 0 ? (
            <LiveTable
              params={session.params}
              values={values}
              raw={session.latestRaw}
              evaluations={evaluations}
              condition={condition}
              history={history}
            />
          ) : (
            <Intro />
          )}
        </div>
        <aside className={cx("col-side")}>
          {session && connected && isEngine && (
            <FuelPanel
              values={values}
              trip={trip.current}
              settings={fuelSettings}
              onReset={resetTrip}
              onSettings={setFuelSettings}
              onCalibrate={(pumped) => {
                try {
                  setFuelSettings(calibrate(fuelSettings, trip.current.litres, pumped));
                  resetTrip();
                  return null;
                } catch (err) {
                  return describeError(err);
                }
              }}
            />
          )}
          {session && connected && (
            <CoveragePanel
              session={session}
              disabled={!connected}
              onChanged={() => setTick((n) => n + 1)}
              onMessage={setMessage}
            />
          )}
          <FaultCodesPanel
            title={session && !isEngine ? m.faultCodesOf(m.units[session.unit]) : m.faultCodes}
            canClear={!session || UNITS[session.unit].canClearCodes}
            codes={codes}
            disabled={!connected}
            onRead={async () => {
              try {
                setCodes(await session!.readFaultCodes());
              } catch (err) {
                setMessage(describeError(err));
              }
            }}
            onClear={async () => {
              try {
                await session!.clearFaultCodes();
                setCodes(await session!.readFaultCodes());
              } catch (err) {
                setMessage(describeError(err));
              }
            }}
          />
          {session && <BitsPanel params={session.params} values={values} />}
          <section className={cx("card")}>
            <h2>{m.logging}</h2>
            <div className={cx("actions")}>
              <button onClick={toggleRecording} disabled={!connected} className={cx(recording ? "rec" : "")}>
                {recording ? m.stopRecording(recording.length) : m.recordCsv}
              </button>
              <button
                onClick={() =>
                  downloadText(
                    `consult-traffic-${timestampForFile()}.txt`,
                    traffic.current.join("\n") + "\n",
                    "text/plain",
                  )
                }
                disabled={traffic.current.length === 0}
                title={m.saveTrafficTitle}
              >
                {m.saveTraffic}
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
