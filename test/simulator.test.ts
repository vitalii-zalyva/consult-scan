import { afterEach, describe, expect, it } from "vitest";

import type { ParamValues } from "@/protocol";
import { ConsultClient, ConsultSession, pageParams, param, PARAMS, paramsForRegisters } from "@/protocol";
import { SIM_SUPPORTED_REGISTERS } from "@/simulator";
import { SimulatorTransport } from "@/transport";

let transport: SimulatorTransport | null = null;
afterEach(async () => {
  await transport?.close();
  transport = null;
});

async function connectedClient() {
  transport = new SimulatorTransport({ frameIntervalMs: 5 });
  await transport.open();
  const client = new ConsultClient(transport);
  await client.init();
  return { client, transport };
}

describe("SIM-1xx: fake ECU speaks Consult-I", () => {
  it("answers part number and fault codes", async () => {
    const { client } = await connectedClient();
    expect((await client.readPartNumber()).partNumber).toContain("23710-");
    expect((await client.readFaultCodes()).map((c) => c.code)).toEqual([34]);
  });

  it("clears fault codes (CP-302)", async () => {
    const { client } = await connectedClient();
    await client.clearFaultCodes();
    expect(await client.readFaultCodes()).toEqual([]);
  });

  it("reports unsupported registers with FE (CP-501)", async () => {
    const { client } = await connectedClient();
    expect(await client.probeRegister(0x00)).toBe(true);
    expect(await client.probeRegister(0x29)).toBe(false);
    // The ECU must still respond normally afterwards.
    expect(await client.probeRegister(0x08)).toBe(true);
  });

  it("streams decoded values", async () => {
    const { client } = await connectedClient();
    const frames: ParamValues[] = [];
    const handle = await client.stream([param("coolant"), param("battery"), param("rpm")], (v) => frames.push(v));
    await new Promise((r) => setTimeout(r, 60));
    await handle.stop();
    expect(frames.length).toBeGreaterThan(3);
    expect(frames[0]!.coolant).toBeGreaterThanOrEqual(-50);
    expect(Object.keys(frames[0]!)).toEqual(["coolant", "battery", "rpm"]);
  });
});

describe("LD-102: paging over the 20-register limit", () => {
  it("never splits a multi-byte param and keeps each page ≤ 20 registers", () => {
    const pages = pageParams(PARAMS);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(page.flatMap((p) => p.registers).length).toBeLessThanOrEqual(20);
    expect(pages.flat()).toEqual([...PARAMS]);
  });
});

describe("Session: connect + detect + stream pages", () => {
  it("detects the simulated register set and streams every supported param", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 2 });
    const seen = new Set<string>();
    const session = new ConsultSession(transport, {
      onSample: (s) => Object.keys(s.values).forEach((k) => seen.add(k)),
    });
    await session.connect();
    expect(session.params.map((p) => p.id)).toEqual(paramsForRegisters(SIM_SUPPORTED_REGISTERS).map((p) => p.id));

    await session.startStreaming(3);
    await new Promise((r) => setTimeout(r, 400));
    const codes = await session.readFaultCodes();
    expect(codes).toHaveLength(1);
    await new Promise((r) => setTimeout(r, 100));
    await session.stopStreaming();

    for (const p of session.params) expect(seen.has(p.id)).toBe(true);
    expect(session.state).toBe("idle");
  }, 10_000);
});
