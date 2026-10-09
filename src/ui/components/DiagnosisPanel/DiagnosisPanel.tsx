import type { Diagnosis } from "@/analysis/diagnosis";
import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import styles from "./DiagnosisPanel.module.css";

const cx = createCx(styles);

/** DX-301..303: possible problems with evidence, checks and coverage. */
export function DiagnosisPanel({ diagnosis }: { diagnosis: Diagnosis }) {
  const t = m.dx;
  const { problems, coverage } = diagnosis;
  const ran = coverage.filter((c) => c.status !== "waiting").length;
  const waiting = coverage.filter((c) => c.status === "waiting");
  const needs = [...new Set(waiting.map((c) => c.needs))];

  return (
    <section className={cx("card diagnosis")}>
      <div className={cx("card-head")}>
        <h2>
          {t.title} <span className={cx("count")}>{problems.length}</span>
        </h2>
        <span className={cx("small muted")}>{t.checksRun(ran, coverage.length)}</span>
      </div>

      {problems.length === 0 ? (
        <p className={cx(ran ? "ok-text" : "muted")}>{ran ? t.nothing(ran) : t.collecting}</p>
      ) : (
        <ul className={cx("problems")}>
          {problems.map((p) => (
            <li key={p.id} className={cx(`problem st-${p.severity}`)}>
              <details>
                <summary>
                  <span className={cx("dot")} />
                  <span className={cx("ptitle")}>{p.title}</span>
                  <span className={cx(`conf conf-${p.confidence}`)}>
                    {p.confidence === "likely" ? t.likely : t.possible}
                  </span>
                </summary>
                <div className={cx("pbody")}>
                  <ul className={cx("evidence")}>
                    {p.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  <div className={cx("small")}>
                    <b>{t.whatToCheck}</b>
                    <ol>
                      {p.checks.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {needs.length > 0 && (
        <p className={cx("small muted")}>{t.waitingFor(needs.join("; "), waiting.map((c) => c.label).join(", "))}</p>
      )}
      <p className={cx("small muted disclaimer")}>{t.disclaimer}</p>
    </section>
  );
}
