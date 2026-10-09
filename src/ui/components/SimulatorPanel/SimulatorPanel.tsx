import { useState } from "react";

import type { FakeEcu } from "@/simulator/fake-ecu";
import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import { FAULTS, SCENARIOS } from "./constants";
import styles from "./SimulatorPanel.module.css";

const cx = createCx(styles);

/** SIM-301: controls for the fake ECU, shown only in simulator mode. */
export function SimulatorPanel({ ecu }: { ecu: FakeEcu }) {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  return (
    <section className={cx("card sim")}>
      <h2>{m.simulator}</h2>
      <div className={cx("seg")} role="group">
        {SCENARIOS.map((id) => (
          <button
            key={id}
            className={cx(ecu.engine.scenario === id ? "active" : "")}
            onClick={() => {
              ecu.engine.scenario = id;
              refresh();
            }}
          >
            {m.scenarios[id]}
          </button>
        ))}
      </div>
      <div className={cx("chips")}>
        {FAULTS.map((id) => (
          <label key={id} className={cx("chip")}>
            <input
              name={`sim-fault-${id}`}
              type="checkbox"
              checked={ecu.engine.faults.has(id)}
              onChange={(e) => {
                if (e.target.checked) ecu.engine.faults.add(id);
                else ecu.engine.faults.delete(id);
                refresh();
              }}
            />
            {m.faults[id]}
          </label>
        ))}
        <label className={cx("chip")}>
          {m.simWeakCylinder}
          <select
            name="sim-weak-cylinder"
            value={ecu.engine.weakCylinder ?? 0}
            onChange={(e) => {
              const n = Number(e.target.value);
              ecu.engine.weakCylinder = n || null;
              refresh();
            }}
          >
            <option value={0}>{m.simNone}</option>
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className={cx("chip")}>
          <input
            name="sim-ignore-restore"
            type="checkbox"
            checked={ecu.ignoreRestore}
            onChange={(e) => {
              ecu.ignoreRestore = e.target.checked;
              refresh();
            }}
          />
          {m.simIgnoreRestore}
        </label>
        <label className={cx("chip")}>
          <input
            name="sim-stall-on-cut"
            type="checkbox"
            checked={ecu.engine.stallOnCut}
            onChange={(e) => {
              ecu.engine.stallOnCut = e.target.checked;
              refresh();
            }}
          />
          {m.simStallOnCut}
        </label>
        <button
          className={cx("link")}
          onClick={() => {
            ecu.faultCodes = [...ecu.faultCodes, [33, 0]];
            refresh();
          }}
        >
          {m.storeDtc}
        </button>
        <button
          className={cx("link")}
          onClick={() => {
            ecu.engine.coolant = 20;
            refresh();
          }}
        >
          {m.coldRestart}
        </button>
      </div>
    </section>
  );
}
