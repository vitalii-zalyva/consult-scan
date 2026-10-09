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
