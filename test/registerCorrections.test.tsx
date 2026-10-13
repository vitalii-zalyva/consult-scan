import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  detectCondition,
  ecuBase,
  evaluateAll,
  rulesWithout,
  SUSPECT_REGISTERS,
  suspectParams,
  VQ30DE_RULES,
} from "@/analysis";
import type { ParamValues } from "@/protocol";
import { PARAM_BY_ID, PARAMS } from "@/protocol";
import { encodeParam } from "@/simulator";
import { LiveTable } from "@/ui/components";
import { m } from "@/ui/messages";

import { loadCsv } from "./helpers/csv";

const A32 = "23710-44U01 (ROM 048A)";
const SUSPECT = ["o2HeaterB1", "o2HeaterB2", "wastegate"];

/**
 * The 2026-10-13 fixtures were exported with the old generic decoders; recover the raw bytes:
 * rpmRef = u16 × 8, baseFuel = 0x34 / 100, mafGs = 0x38.
 */
const rawOf = (v: ParamValues) => {
  const ref = Math.round(v.rpmRef! / 8);
  return { ref: [ref >> 8, ref & 0xff], x34: Math.round(v.baseFuel! * 100), x33: v.calLoad!, x38: v.mafGs! };
};
const decode = (id: string, bytes: number[]) => PARAM_BY_ID.get(id)!.decode(bytes);
const warmIdle = () => loadCsv("a32-vq30de-2026-10-13-warm-idle.csv");

describe("RC-1xx: suspect registers per ECU", () => {
  it("RC-101: lists the still-unknown params for 23710-44U01", () => {
    expect([...suspectParams(A32).keys()].sort()).toEqual(SUSPECT);
  });

  it("RC-102: matches on the part number without the ROM suffix", () => {
    expect(ecuBase(A32)).toBe("23710-44U01");
    expect(suspectParams("23710-44U01 (ROM 0499)").size).toBe(SUSPECT.length);
  });

  it("RC-107: other or unknown ECUs keep the previous behaviour", () => {
    expect(suspectParams("23710-0A503 (ROM 2114)").size).toBe(0);
    expect(suspectParams("").size).toBe(0);
    expect(suspectParams(undefined).size).toBe(0);
    expect(rulesWithout(VQ30DE_RULES, suspectParams(undefined))).toBe(VQ30DE_RULES);
  });

  it("RC-105: drops reference rules for suspect params only", () => {
    const fake = new Map([["timing", null]]);
    expect(rulesWithout(VQ30DE_RULES, fake).some((r) => r.param === "timing")).toBe(false);
    expect(rulesWithout(VQ30DE_RULES, fake).some((r) => r.param === "coolant")).toBe(true);
  });

  it("RC-103/104: suspect row stays visible with raw bytes, tagged and not coloured", () => {
    const values = { rpm: 950, coolant: 82, wastegate: 180, timing: 26 };
    const suspect = suspectParams(A32);
    const rules = rulesWithout(VQ30DE_RULES, suspect);
    const html = renderToStaticMarkup(
      <LiveTable
        params={PARAMS}
        values={values}
        raw={{ wastegate: [0xb4] }}
        evaluations={evaluateAll(values, "warm-idle", rules)}
        condition="warm-idle"
        history={[]}
        rules={rules}
        suspect={suspect}
      />,
    );
    const row = html.match(/<tr class="st-([\w-]+)"(?:(?!<\/tr>).)*WASTE GATE SOL(?:(?!<\/tr>).)*<\/tr>/s);
    expect(row?.[1]).toBe("suspect");
    expect(row?.[0]).toContain(">suspect<");
    expect(row?.[0]).toContain("B4");
    const timingRow = html.match(/<tr class="st-(\w+)"(?:(?!<\/tr>).)*Ignition timing/s);
    expect(timingRow?.[1]).toBe("bad"); // real-car finding stays visible
  });
});

describe("RC-2xx: first A32 car session", () => {
  it("RC-201: warm-idle recording gives no out-of-range result for suspect params", () => {
    const samples = warmIdle();
    expect(samples.length).toBeGreaterThan(1000);
    const suspect = suspectParams(A32);
    const rules = rulesWithout(VQ30DE_RULES, suspect);
    for (const s of samples) {
      const ev = evaluateAll(s.values, detectCondition(s.values), rules);
      for (const id of suspect.keys()) expect(ev[id]?.status ?? "na").toBe("na");
    }
  });

  it("RC-201: engine-off recording loads", () => {
    expect(loadCsv("a32-vq30de-2026-10-13-engine-off.csv").every((s) => s.values.rpm === 0)).toBe(true);
  });
});

describe("RC-4xx: A32 decoders against the car recording", () => {
  it("RC-401: REF engine speed (2 494 000 / raw) agrees with POS rpm within 5 %", () => {
    for (const s of warmIdle()) {
      const ref = decode("rpmRef", rawOf(s.values).ref);
      expect(Math.abs(ref - s.values.rpm!) / s.values.rpm!).toBeLessThan(0.05);
    }
  });

  it("RC-402: CAL/LD = 0x33 + 0x34/255 is smooth at steady idle", () => {
    const loads = warmIdle().map((s) => decode("calLoad", [rawOf(s.values).x33, rawOf(s.values).x34]));
    expect(Math.min(...loads)).toBeGreaterThan(15);
    expect(Math.max(...loads)).toBeLessThan(25);
    expect(PARAMS.some((p) => p.id === "baseFuel")).toBe(false);
  });

  it("RC-403: MAF 0x38 is a percentage, no g/s param and no g/s ranges", () => {
    expect(decode("mafPct", [warmIdle()[0]!.values.mafGs!])).toBe(1);
    expect(PARAM_BY_ID.get("mafPct")!.unit).toBe("%");
    expect(PARAMS.some((p) => p.id === "mafGs")).toBe(false);
    expect(VQ30DE_RULES.some((r) => r.param === "mafGs" || r.param === "baseFuel")).toBe(false);
  });

  it("RC-401/402: simulator encoders invert the non-linear decoders", () => {
    for (const [id, v] of [
      ["rpmRef", 950],
      ["rpmRef", 0],
      ["calLoad", 19.4],
      ["calLoad", 0],
    ] as const) {
      const p = PARAM_BY_ID.get(id)!;
      expect(p.decode(encodeParam(p, v))).toBeCloseTo(v, 0);
    }
  });
});

describe("RC-301: texts", () => {
  it("has tag, tooltip and a reason for every entry", () => {
    expect(m.suspect).toBeTruthy();
    expect(m.suspectTitle).toBeTruthy();
    for (const e of SUSPECT_REGISTERS) expect(e.reason).toBeTruthy();
  });
});
