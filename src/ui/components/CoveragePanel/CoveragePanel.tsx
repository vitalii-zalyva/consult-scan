import { useRef, useState } from "react";

import { registersOf } from "@/protocol/registers";
import { UNITS } from "@/protocol/units";
import { describeError, m } from "@/ui/messages";

import { deepScanKey } from "./deepScanKey";
import type { CoveragePanelProps } from "./types";

/** XD-3xx, CU-102: what is being read, and the tools to find more. */
export function CoveragePanel({ session, disabled, onChanged, onMessage }: CoveragePanelProps) {
  const [busy, setBusy] = useState<null | "units" | "deep">(null);
  const abort = useRef<AbortController | null>(null);
  const mapped = registersOf(UNITS[session.unit].params).length;
  const answering = registersOf(session.params).length;

  const scanUnits = async () => {
    setBusy("units");
    try {
      await session.scanUnits();
      onChanged();
    } catch (err) {
      onMessage(describeError(err));
    } finally {
      setBusy(null);
    }
  };

  const deepScan = async () => {
    abort.current = new AbortController();
    setBusy("deep");
    try {
      const found = await session.deepScan(abort.current.signal);
      if (!abort.current.signal.aborted) {
        try {
          localStorage.setItem(deepScanKey(session.partNumber, session.unit), JSON.stringify(found));
        } catch {
          /* storage unavailable */
        }
      }
      onChanged();
    } catch (err) {
      onMessage(describeError(err));
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  return (
    <section className="card">
      <h2>{m.coverageTitle}</h2>
      <p className="small">
        {m.coverageSummary(
          session.params.length,
          answering,
          m.units[session.unit],
          mapped,
          session.undocumented.length,
        )}
      </p>
      <div className="actions">
        <button onClick={() => void scanUnits()} disabled={disabled || busy !== null} title={m.scanUnitsTitle}>
          {busy === "units" ? m.scanningUnits : m.scanUnits}
        </button>
        {busy === "deep" ? (
          <button onClick={() => abort.current?.abort()}>{m.cancelDeepScan}</button>
        ) : (
          <button onClick={() => void deepScan()} disabled={disabled || busy !== null} title={m.deepScanTitle}>
            {m.deepScan}
          </button>
        )}
      </div>
    </section>
  );
}
