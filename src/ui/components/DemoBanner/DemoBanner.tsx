import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import styles from "./DemoBanner.module.css";

const cx = createCx(styles);

/** DM-104, DM-105: what this page is, and a one-click simulator start. */
export function DemoBanner({ onStart }: { onStart: () => void }) {
  const t = m.demo;
  return (
    <section className={cx("card demo")}>
      <h2>{t.title}</h2>
      <p>{t.about}</p>
      <p>{t.simulated}</p>
      <button className={cx("primary")} onClick={onStart}>
        {t.start}
      </button>
      <p className={cx("muted")}>{t.cable}</p>
    </section>
  );
}
