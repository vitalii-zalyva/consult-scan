import { createCx } from "@/ui/lib";
import { m } from "@/ui/messages";

import styles from "./Intro.module.css";

const cx = createCx(styles);

export function Intro() {
  const t = m.intro;
  return (
    <section className={cx("card intro")}>
      <h2>{t.title}</h2>
      <ol>
        <li>{t.step1}</li>
        <li>{t.step2}</li>
        <li>
          {t.step3a} <code>usbserial</code>
          {t.step3b}
        </li>
        <li>
          {t.step4a} <code>system_profiler SPUSBDataType</code> {t.step4b}
        </li>
      </ol>
      <p className={cx("muted")}>{t.noCable}</p>
    </section>
  );
}
