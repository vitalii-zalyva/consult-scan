import { afterEach, describe, expect, it } from "vitest";

import { detectCondition, evaluateAll, VQ30DE_RULES } from "@/analysis";
import type { ParamValues } from "@/protocol";
import { ConsultClient, param } from "@/protocol";
import type { Scenario } from "@/simulator";
import { createEngineState, engineValues, stepEngine } from "@/simulator";
import { SimulatorTransport } from "@/transport";

let transport: SimulatorTransport | null = null;
afterEach(async () => {
  await transport?.close();
  transport = null;
});

describe("CP-104: init while the ECU is still streaming", () => {
  it("stops the old stream and connects again", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 5 });
    await transport.open();
    // A previous session (e.g. a closed tab) left the ECU streaming: raw bytes, no client.
    await transport.write(Uint8Array.of(0xff, 0xff, 0xef, 0x5a, 0x00, 0x5a, 0x01, 0xf0));
    await new Promise((r) => setTimeout(r, 30));

    const client = new ConsultClient(transport);
    await client.init();
    expect((await client.readFaultCodes()).map((c) => c.code)).toEqual([34]);
  });
});

describe("CP-402: frame resync", () => {
  it("skips garbage before the frame start byte", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 5 });
    await transport.open();
    const client = new ConsultClient(transport);
    await client.init();
    const frames: ParamValues[] = [];
    const handle = await client.stream([param("coolant")], (v) => frames.push(v));
    // Inject noise into the receive path between frames.
    (transport as unknown as { queue: { push(b: Uint8Array): void } }).queue.push(Uint8Array.of(0x00, 0x13, 0x37));
    await new Promise((r) => setTimeout(r, 40));
    await handle.stop();
    expect(frames.length).toBeGreaterThan(2);
    for (const f of frames) expect(f.coolant).toBeGreaterThanOrEqual(-50);
  });
});

function settle(scenario: Scenario, seconds: number): ParamValues[] {
  const s = createEngineState(85);
  s.scenario = scenario;
  const out: ParamValues[] = [];
  for (let t = 0; t < seconds * 20; t++) {
    stepEngine(s, 0.05);
    if (t > seconds * 10) out.push(engineValues(s));
  }
  return out;
}

describe("SIM-203: healthy simulator stays within reference ranges", () => {
  it.each([
    ["idle", "warm-idle"],
    ["rev2000", "warm-2000"],
  ] as const)("%s", (scenario, condition) => {
    for (const values of settle(scenario, 20)) {
      expect(detectCondition(values)).toBe(condition);
      const bad = Object.entries(evaluateAll(values, condition, VQ30DE_RULES)).filter(
        ([, e]) => e?.status !== "ok" && e?.status !== "na",
      );
      expect(
        bad.map(([id, e]) => `${id}=${values[id]?.toFixed(2)} (${e?.failing.map((r) => r.note).join("; ")})`),
      ).toEqual([]);
    }
  });
});
