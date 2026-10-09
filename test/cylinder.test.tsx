import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompressionEntry, PowerBalanceResult } from "@/analysis";
import {
  compressionHints,
  diagnose,
  evaluateCompression,
  fromKpa,
  latestPair,
  toKpa,
  VQ30DE_COMPRESSION,
} from "@/analysis";
import { compressionCsv, powerBalanceCsv } from "@/logging";
import { CompressionPanel } from "@/ui/components";

const entry = (readings: (number | null)[], over: Partial<CompressionEntry> = {}): CompressionEntry => ({
  id: "x",
  date: "2026-10-09T12:00:00.000Z",
  warm: true,
  wet: false,
  readingsKpa: readings,
  ...over,
});

describe("CY-501: units", () => {
  it("converts to and from kPa", () => {
    expect(toKpa(13, "kgf/cm2")).toBeCloseTo(1274.9, 1);
    expect(toKpa(185, "psi")).toBeCloseTo(1275.5, 0);
    expect(toKpa(12.75, "bar")).toBeCloseTo(1275, 6);
    expect(fromKpa(981, "kgf/cm2")).toBeCloseTo(10.0, 2);
  });
});

describe("CY-502: evaluation against the VQ30DE spec", () => {
  it("classifies minimum, standard and spread", () => {
    const ev = evaluateCompression(entry([1270, 1250, 1120, 950, 1260, null]));
    expect(ev.cylinders.map((c) => c.status)).toEqual(["ok", "ok", "bad", "bad", "ok", "na"]);
    expect(ev.cylinders[2]!.reasons).toEqual(["below-standard", "spread"]);
    expect(ev.cylinders[3]!.reasons).toContain("below-minimum");
    expect(ev.spreadKpa).toBe(320);
    expect(VQ30DE_COMPRESSION).toEqual({ standardKpa: 1275, minimumKpa: 981, maxDiffKpa: 98 });
  });
});

describe("CY-503: hints", () => {
  it("adjacent low cylinders on one bank → head gasket", () => {
    const hints = compressionHints(evaluateCompression(entry([1270, 1260, 900, 1270, 910, 1265])));
    expect(hints).toContainEqual({ kind: "head-gasket", cylinders: [3, 5] });
  });
  it("wet rise → rings, no rise → valves", () => {
    const dry = evaluateCompression(entry([1270, 900, 1260, 900, 1270, 1265]));
    const wet = evaluateCompression(entry([1280, 1150, 1265, 910, 1275, 1270], { wet: true }));
    expect(compressionHints(dry, wet)).toEqual(
      expect.arrayContaining([
        { kind: "rings", cylinder: 2 },
        { kind: "valves", cylinder: 4 },
      ]),
    );
  });
  it("pairs the latest dry entry with a same-day wet entry", () => {
    const d = entry([1], { id: "d" });
    const w = entry([1], { id: "w", wet: true });
    const old = entry([1], { id: "o", date: "2025-01-01T12:00:00.000Z" });
    expect(latestPair([old, w, d])).toEqual({ dry: d, wet: w });
  });
});

const pbResult = (weak: number | null, over: Partial<PowerBalanceResult> = {}): PowerBalanceResult => ({
  date: "2026-10-09T10:00:00.000Z",
  rounds: 1,
  dryRun: false,
  inconclusive: false,
  restoreUnconfirmed: false,
  mode: "combined",
  cylinders: [1, 2, 3, 4, 5, 6].map((c) => ({
    cylinder: c,
    dropRpm: c === weak ? 20 : 80,
    dropPct: c === weak ? 2.9 : 11.4,
    minRpm: 600,
    status: c === weak ? "bad" : "ok",
  })),
  ...over,
});

describe("CY-6xx: diagnosis DX-219", () => {
  const base = { samples: [], latest: {}, codes: [] };
  it("waits without results", () => {
    expect(diagnose(base).coverage.find((c) => c.id === "DX-219")?.status).toBe("waiting");
  });
  it("power balance alone → possible; agreement with compression → likely (CY-602)", () => {
    const alone = diagnose({ ...base, cylinders: { powerBalance: pbResult(4) } }).problems.find(
      (p) => p.id === "DX-219-4",
    );
    expect(alone).toMatchObject({ confidence: "possible", severity: "bad" });
    const both = diagnose({
      ...base,
      cylinders: {
        powerBalance: pbResult(4),
        compression: {
          date: "2026-10-09",
          evaluation: evaluateCompression(entry([1270, 1260, 1265, 900, 1270, 1268])),
        },
      },
    }).problems.find((p) => p.id === "DX-219-4");
    expect(both?.confidence).toBe("likely");
    expect(both?.evidence).toHaveLength(2);
  });
  it("ignores dry runs, inconclusive and aborted results", () => {
    for (const over of [{ dryRun: true }, { inconclusive: true }, { aborted: "user" as const }])
      expect(diagnose({ ...base, cylinders: { powerBalance: pbResult(4, over) } }).problems).toEqual([]);
  });
});

describe("CY-306/504: CSV export", () => {
  it("writes one row per cylinder / entry", () => {
    expect(
      powerBalanceCsv([pbResult(3)])
        .trim()
        .split("\n"),
    ).toHaveLength(7);
    expect(compressionCsv([entry([1270, null, 1, 2, 3, 4], { notes: 'a "b"' })])).toContain(",1270,,1,2,3,4,");
  });
});

describe("CY-5xx: compression panel", () => {
  it("renders the log form", () => {
    const html = renderToStaticMarkup(<CompressionPanel onChange={() => {}} />);
    expect(html).toContain("Compression log");
    expect(html).toContain("Save");
  });
});

describe("CY-401/402: power balance panel", () => {
  it("shows interlock reasons when Start is blocked", async () => {
    const { ConsultSession } = await import("@/protocol");
    const { SimulatorTransport } = await import("@/transport");
    const { PowerBalancePanel } = await import("@/ui/components");
    const session = new ConsultSession(new SimulatorTransport());
    const html = renderToStaticMarkup(
      <PowerBalancePanel session={session} connected={true} isEngine={true} onResult={() => {}} />,
    );
    expect(html).toContain("Power balance test");
    expect(html).toContain("Waiting for live data.");
    expect(html).toMatch(/<button class="primary" disabled="">/);
  });
});
