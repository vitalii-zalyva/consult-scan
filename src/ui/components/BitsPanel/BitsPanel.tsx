import type { ParamDef, ParamValues } from "@/protocol/registers";
import { formatValue } from "@/protocol/registers";
import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import styles from "./BitsPanel.module.css";

const cx = createCx(styles);

/** LD-205, XD-201: bit registers as labelled lamps. */
export function BitsPanel({ params, values }: { params: readonly ParamDef[]; values: ParamValues }) {
  const rows = params.filter((p) => p.kind === "bits");
  if (!rows.length) return null;
  return (
    <section className={cx("card")}>
      <h2>{m.bitsTitle}</h2>
      <p className={cx("muted small")}>{m.bitsNote}</p>
      {rows.map((p) => {
        const v = values[p.id];
        return (
          <div key={p.id} className={cx("bits-block")}>
            <div className={cx("bits-head")}>
              <span>{p.label}</span>
              <code>{formatValue(p, v)}</code>
            </div>
            <div className={cx("bits-grid")}>
              {Array.from({ length: 8 }, (_, i) => 7 - i).map((bit) => {
                const on = v !== undefined && ((v >> bit) & 1) === 1;
                const label = p.bitLabels?.[bit] ?? null;
                return (
                  <span
                    key={bit}
                    className={cx(`bit ${on ? "on" : ""} ${label ? "" : "unlabelled"}`)}
                    title={m.bit(bit)}
                  >
                    <span className={cx("lamp")} />
                    {label ?? m.bit(bit)}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
