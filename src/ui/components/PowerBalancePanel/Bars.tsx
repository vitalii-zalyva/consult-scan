import { createCx } from "@/ui/lib";
import { fmt } from "@/ui/messages";

import styles from "./PowerBalancePanel.module.css";
import type { BarRow } from "./types";

const cx = createCx(styles);

export function Bars({
  rows,
  max,
  label,
  statusText,
  aacLabel,
}: {
  rows: BarRow[];
  max: number;
  label: (n: number) => string;
  statusText?: Record<"ok" | "warn" | "bad", string>;
  aacLabel?: string;
}) {
  return (
    <div className={cx("bars")}>
      {rows.map((r) => (
        <div key={`${r.cylinder}-${r.drop}`} className={cx(`bar-row st-${r.status}`)}>
          <span className={cx("bar-label")}>{label(r.cylinder)}</span>
          <span className={cx("bar-track")}>
            <span
              className={cx("bar-fill")}
              style={{ width: `${Math.max(2, Math.min(100, (r.drop / max) * 100))}%` }}
            />
          </span>
          <span className={cx("bar-value")}>
            −{fmt(r.drop, 0)}
            {r.pct !== undefined && ` (${fmt(r.pct, 1)} %)`}
            {statusText && r.status !== "na" && ` · ${statusText[r.status]}`}
            {aacLabel && r.aacRise !== undefined && ` · ${aacLabel} +${fmt(r.aacRise, 1)} %`}
          </span>
        </div>
      ))}
    </div>
  );
}
