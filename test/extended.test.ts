import { afterEach, describe, expect, it } from "vitest";

import {
  ALL_REGISTERS,
  AT_PARAMS,
  CLIMATE_PARAMS,
  ConsultClient,
  ConsultError,
  ConsultSession,
  formatValue,
  param,
  PARAMS,
} from "@/protocol";
import { encodeParam } from "@/simulator";
import { SimulatorTransport } from "@/transport";

let transport: SimulatorTransport | null = null;
afterEach(async () => {
  await transport?.close();
  transport = null;
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const FAST = { initTimeoutMs: 150, initAttempts: 2, byteTimeoutMs: 150, frameTimeoutMs: 300, quietMs: 15 };

describe("XD-101: full PLMS engine register map", () => {
  it("covers every address in the PLMS generic table", () => {
    const plms = [
      0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0f, 0x11, 0x12, 0x13, 0x14,
      0x15, 0x16, 0x17, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x21, 0x22, 0x23, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x2e,
      0x2f, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x4a, 0x52, 0x53,
    ];
    expect(plms.filter((r) => !ALL_REGISTERS.includes(r))).toEqual([]);
  });

  it("has unique ids across all units", () => {
    const ids = [...PARAMS, ...AT_PARAMS, ...CLIMATE_PARAMS].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each([...PARAMS, ...AT_PARAMS].map((p) => [p.id, p] as const))(
    "%s decoder is linear (simulator can encode it)",
    (_, p) => {
      const sample = p.decode(p.registers.map(() => 0x37));
      expect(p.decode(encodeParam(p, sample))).toBeCloseTo(sample, 6);
    },
  );
});

describe("XD-201: bit labels", () => {
  it("labels 0x13 per the PLMS table", () => {
    expect(param("bits13").bitLabels?.[0]).toBe("Closed throttle");
    expect(param("bits13").bitLabels?.[4]).toBe("A/C switch");
    expect(param("bits1e").bitLabels?.[6]).toBe("Fuel pump relay");
  });
});

describe("XD-3xx: deep scan", () => {
  it("finds undocumented registers and streams them as raw values", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 2 });
    const session = new ConsultSession(transport, {}, FAST);
    await session.connect();
    const found = await session.deepScan();
    expect(found).toEqual([0x45]);
    expect(session.undocumented.map((p) => p.id)).toEqual(["reg_45"]);

    await session.startStreaming(3);
    await wait(500);
    await session.stopStreaming();
    expect(session.latest.reg_45).toBeTypeOf("number");
    expect(session.latestRaw.reg_45).toHaveLength(1);
  }, 20_000);

  it("can be cancelled (XD-304) and restored from a saved result (XD-303)", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 2 });
    const session = new ConsultSession(transport, {}, FAST);
    await session.connect();
    const ctl = new AbortController();
    ctl.abort();
    expect(await session.deepScan(ctl.signal)).toEqual([]);
    expect(session.undocumented).toEqual([]);
    session.applyDeepScan([0x45]);
    expect(session.params.at(-1)?.id).toBe("reg_45");
  });
});

describe("CU-1xx/2xx: other control units", () => {
  it("finds engine and A/T, and nothing answers for climate/HICAS", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 2 });
    const session = new ConsultSession(transport, {}, FAST);
    await session.connect();
    expect(await session.scanUnits()).toEqual(["engine", "at"]);
    // Engine is re-selected afterwards and still works.
    expect((await session.readFaultCodes()).map((c) => c.code)).toEqual([34]);
  }, 10_000);

  it("streams A/T data after switching units", async () => {
    transport = new SimulatorTransport({ frameIntervalMs: 2 });
    const session = new ConsultSession(transport, {}, FAST);
    await session.connect();
    await session.selectUnit("at");
    expect(session.params.map((p) => p.id)).toEqual(AT_PARAMS.map((p) => p.id));
    await session.startStreaming();
    await wait(200);
    await session.stopStreaming();
    expect(formatValue(param("at.lever", AT_PARAMS), session.latest["at.lever"])).toBe("N/P");
    expect(session.latest["at.gear"]).toBe(1);
    expect(await session.readFaultCodes()).toEqual([]);
    await expect(session.clearFaultCodes()).rejects.toThrow(/engine/);
  });

  it("an absent unit fails init quickly", async () => {
    transport = new SimulatorTransport();
    await transport.open();
    const client = new ConsultClient(transport, {
      initTimeoutMs: 100,
      initAttempts: 1,
      byteTimeoutMs: 100,
      frameTimeoutMs: 100,
      quietMs: 20,
    });
    await expect(client.init(0xdf, 1)).rejects.toThrow(ConsultError);
    await client.init();
    expect(client.isConnected).toBe(true);
  });
});
