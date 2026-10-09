import { describe, expect, it } from "vitest";

import type { Sample } from "@/analysis";
import { detectCondition, evaluateValue, historyFindings, o2SwitchCount, rulesFor, VQ30DE_RULES } from "@/analysis";
import { toCsv } from "@/logging";
import { param } from "@/protocol";
import { stripFtdiStatus } from "@/transport";

describe("RR-1xx: condition detection", () => {
  it.each([
    [{ rpm: 0 }, "engine-off"],
    [{ rpm: 250 }, "cranking"],
    [{ rpm: 1100, coolant: 30 }, "cold"],
    [{ rpm: 700, coolant: 85 }, "warm-idle"],
    [{ rpm: 2000, coolant: 85 }, "warm-2000"],
    [{ rpm: 3000, coolant: 85 }, "warm-other"],
    [{ rpm: 2500, coolant: 85, speed: 60 }, "driving"],
  ] as const)("%o -> %s", (values, expected) => {
    expect(detectCondition(values)).toBe(expected);
  });
});

describe("RR-3xx: range evaluation", () => {
  const timingIdle = rulesFor("timing", "warm-idle", VQ30DE_RULES);
  it("ok inside the range", () => expect(evaluateValue(15, timingIdle).status).toBe("ok"));
  it("warn just outside (≤10 % of width)", () => expect(evaluateValue(17.3, timingIdle).status).toBe("warn"));
  it("bad far outside", () => expect(evaluateValue(5, timingIdle).status).toBe("bad"));
  it("na without rules", () => expect(evaluateValue(1, []).status).toBe("na"));
  it("applies 'always' rules in every condition", () => {
    expect(rulesFor("coolant", "cold", VQ30DE_RULES)).toHaveLength(1);
    expect(rulesFor("coolant", "warm-idle", VQ30DE_RULES)).toHaveLength(2);
  });
});

const samples = (hz: number, seconds: number, extra: Sample["values"] = {}): Sample[] =>
  Array.from({ length: seconds * 20 }, (_, i) => {
    const t = i * 50;
    return {
      t,
      values: {
        rpm: 2000,
        coolant: 85,
        speed: 0,
        o2Lh: Math.sin(2 * Math.PI * hz * (t / 1000)) > 0 ? 0.8 : 0.1,
        ...extra,
      },
    };
  });

describe("RR-401: O2 switching check", () => {
  it("counts transitions", () => expect(o2SwitchCount(samples(1, 10), "o2Lh")).toBeGreaterThanOrEqual(18));
  it("flags a lazy sensor at 2000 rpm", () => {
    expect(historyFindings(samples(0.1, 11), "warm-2000").map((f) => f.id)).toContain("o2-switch-o2Lh");
  });
  it("passes a healthy sensor", () => {
    expect(historyFindings(samples(1.2, 11), "warm-2000")).toEqual([]);
  });
});

describe("RR-402: mixture trend", () => {
  it("flags lean when alpha and self-learn are both high", () => {
    const f = historyFindings([{ t: 0, values: { afAlphaLh: 125, afLearnLh: 118 } }], "warm-idle");
    expect(f.map((x) => x.id)).toContain("lean-trend");
  });
});

describe("LOG-1xx: CSV", () => {
  it("writes a header with units and relative time", () => {
    const csv = toCsv(
      [param("rpm"), param("coolant")],
      [
        { t: 1000, values: { rpm: 700, coolant: 85 } },
        { t: 1500, values: { rpm: 712.5 } },
      ],
    );
    expect(csv).toBe("time_s,rpm [rpm],coolant [°C]\n0.000,700,85\n0.500,713,\n");
  });
});

describe("TR-2xx: FTDI packet status stripping", () => {
  it("removes 2 status bytes from every packet", () => {
    const data = Uint8Array.of(0x01, 0x60, 0xaa, 0xbb, 0x01, 0x60, 0xcc);
    expect([...stripFtdiStatus(data, 4)]).toEqual([0xaa, 0xbb, 0xcc]);
  });
});
