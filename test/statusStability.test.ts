import { describe, expect, it } from "vitest";

import type { Sample, Status } from "@/analysis";
import { detectCondition, evaluateAll, StatusFilter, VQ30DE_RULES, windowMean } from "@/analysis";

import { loadCsv } from "./helpers/csv";

/** Status of every param after each sample; `smooth` = RR-304 (3 s mean) + RR-305 (2 s hold), else the raw latest sample. */
function statusTrace(samples: readonly Sample[], smooth: boolean) {
  const trace: Record<string, Status[]> = {};
  const filter = new StatusFilter();
  samples.forEach((s, i) => {
    const judged = smooth ? windowMean(samples.slice(Math.max(0, i - 200), i + 1)) : s.values;
    const all = evaluateAll(judged, detectCondition(judged), VQ30DE_RULES);
    const ev = smooth ? filter.update(all, s.t) : all;
    for (const [id, e] of Object.entries(ev)) (trace[id] ??= []).push(e!.status);
  });
  return trace;
}
const flips = (xs: readonly Status[]) => xs.filter((x, i) => i > 0 && x !== xs[i - 1]).length;

describe("RR-102/304: no status flicker on the A32 warm-idle recording (2026-10-13)", () => {
  const samples = loadCsv("a32-vq30de-2026-10-13-warm-idle-2.csv");

  it("RR-102: the whole 75 s idle (925–1025 rpm, throttle closed) is warm idle", () => {
    expect(samples.every((s) => detectCondition(s.values) === "warm-idle")).toBe(true);
  });

  it("RR-304/305: statuses judged on the 3 s mean with a 2 s hold flip at most twice per param", () => {
    const raw = statusTrace(samples, false);
    const smooth = statusTrace(samples, true);
    expect(Math.max(...Object.values(raw).map(flips))).toBeGreaterThan(20); // what the user saw
    for (const [id, xs] of Object.entries(smooth)) expect(flips(xs), id).toBeLessThanOrEqual(2);
  });

  it("RR-304: windowMean averages only the last 3 s", () => {
    const m = windowMean([
      { t: 0, values: { rpm: 5000 } },
      { t: 5000, values: { rpm: 900 } },
      { t: 6000, values: { rpm: 1000 } },
    ]);
    expect(m.rpm).toBe(950);
    expect(windowMean([])).toEqual({});
  });

  it("RR-305: a status change shows only after it held for 2 s", () => {
    const f = new StatusFilter();
    const ev = (status: Status) => ({ x: { status, applied: [], failing: [] } });
    expect(f.update(ev("ok"), 0).x!.status).toBe("ok");
    expect(f.update(ev("bad"), 100).x!.status).toBe("ok");
    expect(f.update(ev("ok"), 500).x!.status).toBe("ok");
    expect(f.update(ev("bad"), 600).x!.status).toBe("ok");
    expect(f.update(ev("bad"), 2_700).x!.status).toBe("bad");
  });
});
