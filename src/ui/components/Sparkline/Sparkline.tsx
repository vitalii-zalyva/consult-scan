import { createCx } from "@/ui/lib";

import styles from "./Sparkline.module.css";
import type { SparklineProps } from "./types";

const cx = createCx(styles);

/** Tiny SVG trend line with the expected band shaded. */
export function Sparkline({ samples, param, range, width = 140, height = 28 }: SparklineProps) {
  const pts = samples.flatMap((s) => (s.values[param] === undefined ? [] : [s.values[param]]));
  if (pts.length < 2) return <svg width={width} height={height} aria-hidden />;
  let lo = Math.min(...pts);
  let hi = Math.max(...pts);
  if (range) {
    lo = Math.min(lo, range.min);
    hi = Math.max(hi, range.max);
  }
  if (hi - lo < 1e-6) hi = lo + 1;
  const y = (v: number) => height - 2 - ((v - lo) / (hi - lo)) * (height - 4);
  const x = (i: number) => (i / (pts.length - 1)) * width;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  return (
    <svg width={width} height={height} className={cx("spark")} aria-hidden>
      {range && (
        <rect
          x={0}
          width={width}
          y={y(range.max)}
          height={Math.max(1, y(range.min) - y(range.max))}
          className={cx("spark-band")}
        />
      )}
      <path d={d} className={cx("spark-line")} />
    </svg>
  );
}
