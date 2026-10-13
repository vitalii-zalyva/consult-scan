import { rulesFor } from "@/analysis/evaluate";
import type { ReferenceRule } from "@/analysis/reference-ranges";
import { VQ30DE_RULES } from "@/analysis/reference-ranges";
import { formatRaw, formatValue } from "@/protocol/registers";
import { Sparkline } from "@/ui/components/Sparkline";
import { createCx } from "@/ui/lib";
import { fmt, m, unitLabel } from "@/ui/messages";

import { GROUPS } from "./constants";
import styles from "./LiveTable.module.css";
import type { LiveTableProps } from "./types";

const cx = createCx(styles);

/** LD-201..204, XD-102, RC-103..104: grouped live values with raw bytes, expected range and trend. */
export function LiveTable({
  params,
  values,
  raw,
  evaluations,
  condition,
  history,
  rules = VQ30DE_RULES,
  suspect,
}: LiveTableProps) {
  const note = (r: ReferenceRule) => r.note;
  const range = (r: ReferenceRule) =>
    `${fmt(r.range.min, Number.isInteger(r.range.min) ? 0 : 2)}–${fmt(r.range.max, Number.isInteger(r.range.max) ? 0 : 2)}`;
  return (
    <div className={cx("live")}>
      {GROUPS.map((group) => {
        const rows = params.filter((p) => p.group === group && p.kind !== "bits");
        if (!rows.length) return null;
        return (
          <section key={group} className={cx("card")}>
            <h2>
              {m.groups[group]} <span className={cx("count")}>{rows.length}</span>
            </h2>
            <table className={cx("data")}>
              <thead>
                <tr>
                  <th>{m.colParameter}</th>
                  <th className={cx("num")}>{m.colValue}</th>
                  <th>{m.colExpected}</th>
                  <th className={cx("trend")}>{m.colTrend}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const v = values[p.id];
                  const ev = evaluations[p.id];
                  const rule = rulesFor(p.id, condition, rules).at(-1);
                  const sus = suspect?.get(p.id);
                  const numeric = !p.kind || p.kind === "value";
                  const failing = ev?.failing ?? [];
                  const tooltip = (failing.length ? failing : (ev?.applied ?? [])).map(note).join("; ");
                  return (
                    <tr
                      key={p.id}
                      className={cx(sus ? "st-suspect" : `st-${ev?.status ?? "na"}`)}
                      title={tooltip || undefined}
                    >
                      <td>
                        <div className={cx("pname")}>{p.label}</div>
                        <div className={cx("fsm")}>
                          {p.fsmName} · {m.reg}{" "}
                          {p.registers.map((r) => `0x${r.toString(16).padStart(2, "0").toUpperCase()}`).join("/")}
                          {sus ? (
                            <span className={cx("tag tag-suspect")} title={`${m.suspectTitle} ${sus.reason}`}>
                              {m.suspect}
                            </span>
                          ) : (
                            !p.verified && (
                              <span className={cx("tag")} title={m.unverifiedTitle}>
                                {m.unverified}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className={cx("num")}>
                        <span className={cx("dot")} aria-label={ev?.status} />
                        <span className={cx("val")}>{formatValue(p, v)}</span>
                        <span className={cx("unit")}>{unitLabel(p.unit)}</span>
                        <div className={cx("raw")} title={m.rawTitle}>
                          {formatRaw(raw[p.id])}
                        </div>
                      </td>
                      <td className={cx("expected")}>
                        {ev && ev.status !== "na" ? (
                          ev.applied.map(range).join(", ")
                        ) : (
                          <span className={cx("muted")}>—</span>
                        )}
                        {failing.length > 0 && <div className={cx("why")}>{failing.map(note).join("; ")}</div>}
                      </td>
                      <td className={cx("trend")}>
                        {numeric && <Sparkline samples={history} param={p.id} range={rule?.range} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
