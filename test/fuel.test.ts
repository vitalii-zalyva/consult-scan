import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  addToTrip,
  calibrate,
  deadTimeMs,
  DEFAULT_FUEL_SETTINGS as S,
  emptyTrip,
  fuelRate,
  tripAverage,
} from "@/analysis";
import type { Scenario } from "@/simulator";
import { createEngineState, engineValues, stepEngine } from "@/simulator";
import { FuelPanel } from "@/ui/components";

describe("FU-1xx: instantaneous flow", () => {
  it("FU-101: spec example — 3.1 ms, 700 rpm, 14 V → 1.21 L/h", () => {
    expect(fuelRate({ rpm: 700, injLh: 3.1, battery: 14 }).litresPerHour).toBeCloseTo(1.2096, 3);
  });

  it("FU-102: averages both banks", () => {
    const one = fuelRate({ rpm: 2000, injLh: 3.0, battery: 14 }).litresPerHour;
    const two = fuelRate({ rpm: 2000, injLh: 2.8, injRh: 3.2, battery: 14 }).litresPerHour;
    expect(two).toBeCloseTo(one, 9);
  });

  it("FU-103: dead time grows at low voltage", () => {
    expect(deadTimeMs(14, S)).toBeCloseTo(0.7);
    expect(deadTimeMs(12, S)).toBeCloseTo(1.0);
    expect(deadTimeMs(undefined, S)).toBeCloseTo(0.7);
  });

  it("FU-104: fuel cut and engine off give zero", () => {
    expect(fuelRate({ rpm: 2500, injLh: 0.5, battery: 14 }).litresPerHour).toBe(0);
    expect(fuelRate({ rpm: 0, injLh: 3, battery: 12.5 }).litresPerHour).toBe(0);
  });

  it("FU-106: L/100 km only when moving", () => {
    expect(fuelRate({ rpm: 700, injLh: 3.1, speed: 3 }).litresPer100km).toBeUndefined();
    const r = fuelRate({ rpm: 2400, injLh: 4.03, battery: 14, speed: 70 });
    expect(r.litresPer100km).toBeCloseTo((r.litresPerHour / 70) * 100, 9);
  });

  it("applies the calibration factor", () => {
    const base = fuelRate({ rpm: 700, injLh: 3.1 }).litresPerHour;
    expect(fuelRate({ rpm: 700, injLh: 3.1 }, { ...S, calibration: 1.1 }).litresPerHour).toBeCloseTo(base * 1.1, 9);
  });
});

describe("FU-2xx: trip integration", () => {
  it("FU-201: 1 h at 60 km/h integrates distance; gaps > 2 s are skipped", () => {
    const trip = emptyTrip();
    const v = { rpm: 2400, injLh: 4.03, battery: 14, speed: 60 };
    for (let t = 0; t <= 3_600_000; t += 1000) addToTrip(trip, t, v, S);
    expect(trip.km).toBeCloseTo(60, 6);
    expect(trip.litres).toBeCloseTo(fuelRate(v).litresPerHour, 6);
    expect(tripAverage(trip)).toBeCloseTo((trip.litres / 60) * 100, 9);

    addToTrip(trip, 3_600_000 + 10_000, v, S); // 10 s gap: not integrated
    expect(trip.km).toBeCloseTo(60, 6);
  });
});

describe("FU-3xx: fill-up calibration", () => {
  it("FU-302: 10 L computed, 11 L pumped → factor 1.1", () => {
    expect(calibrate(S, 10, 11).calibration).toBeCloseTo(1.1);
    expect(calibrate({ ...S, calibration: 1.1 }, 10, 10).calibration).toBeCloseTo(1.1);
  });
  it("refuses too short trips and bad input", () => {
    expect(() => calibrate(S, 2, 3)).toThrow(/at least/);
    expect(() => calibrate(S, 10, Number.NaN)).toThrow(/litres/);
  });
});

function warm(scenario: Scenario) {
  const s = createEngineState(85);
  s.scenario = scenario;
  for (let i = 0; i < 400; i++) stepEngine(s, 0.05);
  return engineValues(s);
}

describe("FU-501: simulator fuel rate", () => {
  it("warm idle is plausible (0.5–2.5 L/h)", () => {
    const lh = fuelRate(warm("idle")).litresPerHour;
    expect(lh).toBeGreaterThan(0.5);
    expect(lh).toBeLessThan(2.5);
  });
});

describe("FU-401: fuel panel render", () => {
  it("shows L/h, trip and the calculated tag", () => {
    const html = renderToStaticMarkup(
      createElement(FuelPanel, {
        values: { rpm: 700, injLh: 3.1, battery: 14, coolant: 85 },
        trip: { litres: 1.5, km: 20, durationMs: 30 * 60_000 },
        settings: S,
        onReset: () => {},
        onCalibrate: () => null,
        onSettings: () => {},
      }),
    );
    expect(html).toContain("1.21");
    expect(html).toContain("L/100 km");
    expect(html).toContain("7.5"); // trip average
    expect(html).toContain("calculated");
  });
});
