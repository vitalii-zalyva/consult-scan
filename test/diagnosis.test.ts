import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DiagnosisContext, Sample } from "@/analysis";
import { diagnose, lastSteady, RULE_COUNT } from "@/analysis";
import type { ParamValues } from "@/protocol";
import type { InjectedFault, Scenario } from "@/simulator";
import { createEngineState, engineValues, stepEngine } from "@/simulator";
import { DiagnosisPanel } from "@/ui/components";

const DT = 0.04;

/** Runs the simulator engine model through scenarios and records samples like the session does. */
function simulate(plan: Array<[Scenario, number]>, faults: InjectedFault[] = [], coolant = 85): Sample[] {
  const s = createEngineState(coolant);
  faults.forEach((f) => s.faults.add(f));
  const out: Sample[] = [];
  let t = 0;
  for (const [scenario, seconds] of plan) {
    s.scenario = scenario;
    for (let i = 0; i < seconds / DT; i++) {
      stepEngine(s, DT);
      t += DT * 1000;
      out.push({ t, values: engineValues(s) });
    }
  }
  return out;
}

const ctx = (samples: Sample[], codes: DiagnosisContext["codes"] = []): DiagnosisContext => ({
  samples,
  latest: samples.at(-1)?.values ?? {},
  codes,
});
const ids = (c: DiagnosisContext) => diagnose(c).problems.map((p) => p.id);
const steady = (values: ParamValues, seconds: number, t0 = 0, hz = 25): Sample[] =>
  Array.from({ length: seconds * hz }, (_, i) => ({ t: t0 + (i * 1000) / hz, values }));

describe("DX-102: lastSteady", () => {
  it("returns the last 10 s of the most recent ≥ 8 s stretch, even if the condition changed since", () => {
    const samples = simulate([
      ["idle", 15],
      ["rev2000", 12],
    ]);
    const idle = lastSteady(samples, "warm-idle")!;
    expect(idle).not.toBeNull();
    expect(idle.at(-1)!.t - idle[0]!.t).toBeLessThanOrEqual(10_000);
    expect(idle.at(-1)!.t).toBeLessThan(samples.at(-1)!.t);
    expect(lastSteady(samples, "driving")).toBeNull();
  });
});

describe("DX-105: coverage", () => {
  it("everything waits without data; no problems claimed", () => {
    const d = diagnose({ samples: [], latest: {}, codes: null });
    expect(d.problems).toEqual([]);
    expect(d.coverage).toHaveLength(RULE_COUNT);
    expect(d.coverage.every((c) => c.status === "waiting")).toBe(true);
  });
});

describe("DX-2xx: healthy car (simulator) raises nothing", () => {
  it("warm idle then 2000 rpm", () => {
    const d = diagnose(
      ctx(
        simulate([
          ["idle", 15],
          ["rev2000", 15],
        ]),
      ),
    );
    expect(d.problems.map((p) => `${p.id}: ${p.evidence.join(" ")}`)).toEqual([]);
    expect(d.coverage.filter((c) => c.status === "ok").length).toBeGreaterThanOrEqual(12);
  });
});

describe("DX-2xx: injected faults are detected", () => {
  it("DX-201/202: vacuum leak → lean", () => {
    const found = ids(
      ctx(
        simulate(
          [
            ["idle", 15],
            ["rev2000", 15],
          ],
          ["vacuum-leak"],
        ),
      ),
    );
    expect(found).toContain("DX-201");
    expect(found).toContain("DX-202");
  });

  it("DX-205: lazy O2 at 2000 rpm is bad + likely", () => {
    const d = diagnose(
      ctx(
        simulate(
          [
            ["idle", 5],
            ["rev2000", 15],
          ],
          ["o2-lazy"],
        ),
      ),
    );
    const p = d.problems.find((x) => x.id === "DX-205-o2Lh");
    expect(p).toMatchObject({ severity: "bad", confidence: "likely" });
  });

  it("DX-210: weak alternator", () => {
    expect(ids(ctx(simulate([["idle", 10]], ["weak-alternator"])))).toContain("DX-210-low");
  });

  it("DX-209: overheating", () => {
    const samples = steady({ rpm: 750, coolant: 108, bits1e: 0 }, 2);
    const p = diagnose(ctx(samples)).problems.find((x) => x.id === "DX-209");
    expect(p?.severity).toBe("bad");
    expect(p?.evidence.join(" ")).toMatch(/fan/);
  });

  it("DX-208: thermostat stuck open after 10 min cold", () => {
    const samples = steady({ rpm: 900, coolant: 55, speed: 50 }, 660, 0, 2);
    expect(ids(ctx(samples))).toContain("DX-208");
    expect(ids(ctx(samples.slice(0, 600)))).not.toContain("DX-208"); // only 5 min
  });

  it("DX-212/213: unstable idle and timing off", () => {
    const base = { coolant: 85, speed: 0, timing: 8, tps: 0.5, afAlphaLh: 100, afAlphaRh: 100, aac: 30, bits13: 1 };
    const samples = Array.from({ length: 300 }, (_, i) => ({
      t: i * 40,
      values: { ...base, rpm: 700 + (i % 2 ? 90 : -90) },
    }));
    const found = ids(ctx(samples));
    expect(found).toContain("DX-212");
    expect(found).toContain("DX-213");
  });

  it("DX-216: sensor at rail while running", () => {
    expect(ids(ctx(steady({ rpm: 800, mafLh: 0.1, coolant: 85 }, 1)))).toContain("DX-216-maf");
  });

  it("DX-218: fault codes become problems, present ones first (DX-104)", () => {
    const d = diagnose(
      ctx(steady({ rpm: 0 }, 1), [
        { code: 34, name: "Knock sensor circuit", startsSinceObserved: 5 },
        { code: 12, name: "Mass air flow sensor circuit", startsSinceObserved: 0, hint: "Check MAF" },
      ]),
    );
    expect(d.problems.map((p) => p.id)).toEqual(["DX-218-12", "DX-218-34"]);
    expect(d.problems[0]).toMatchObject({ severity: "bad", confidence: "likely", checks: ["Check MAF"] });
  });
});

describe("DX-3xx: panel", () => {
  it("shows problems with confidence and the disclaimer", () => {
    const d = diagnose(ctx(simulate([["idle", 15]], ["weak-alternator"])));
    const html = renderToStaticMarkup(createElement(DiagnosisPanel, { diagnosis: d }));
    expect(html).toContain("Alternator not charging enough");
    expect(html).toContain("likely");
    expect(html).toContain("checks run");
    expect(html).toContain("FSM procedure");
  });

  it("DX-302: says what is still waiting instead of claiming all-clear", () => {
    const d = diagnose(ctx(simulate([["idle", 15]])));
    const html = renderToStaticMarkup(createElement(DiagnosisPanel, { diagnosis: d }));
    expect(html).toContain("Waiting for:");
    expect(html).toContain("warm 2000 rpm");
  });
});
