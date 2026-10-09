import { useState } from "react";

import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import styles from "./FaultCodesPanel.module.css";
import type { FaultCodesPanelProps } from "./types";

const cx = createCx(styles);

export function FaultCodesPanel({ title, canClear = true, codes, disabled, onRead, onClear }: FaultCodesPanelProps) {
  const [busy, setBusy] = useState(false);
  const run = async (op: () => Promise<void>) => {
    setBusy(true);
    try {
      await op();
    } finally {
      setBusy(false);
    }
  };
  const clear = () => {
    // FC-201: clearing erases the stored diagnosis; require explicit confirmation.
    if (window.confirm(m.clearConfirm)) void run(onClear);
  };

  return (
    <section className={cx("card")}>
      <div className={cx("card-head")}>
        <h2>{title ?? m.faultCodes}</h2>
        <div className={cx("actions")}>
          <button onClick={() => void run(onRead)} disabled={disabled || busy}>
            {m.read}
          </button>
          {canClear && (
            <button className={cx("danger")} onClick={clear} disabled={disabled || busy || !codes?.length}>
              {m.clear}
            </button>
          )}
        </div>
      </div>
      {codes === null ? (
        <p className={cx("muted")}>{m.notReadYet}</p>
      ) : codes.length === 0 ? (
        <p className={cx("ok-text")}>{m.noCodes}</p>
      ) : (
        <ul className={cx("dtc-list")}>
          {codes.map((c) => {
            const hint = c.hint;
            return (
              <li key={c.code} className={cx(c.startsSinceObserved === 0 ? "present" : "past")}>
                <span className={cx("dtc-code")}>{c.code}</span>
                <div>
                  <div className={cx("dtc-name")}>{c.name}</div>
                  <div className={cx("muted small")}>
                    {c.startsSinceObserved === 0 ? m.presentNow : m.lastSeen(c.startsSinceObserved)}
                  </div>
                  {hint && <div className={cx("small")}>{hint}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
