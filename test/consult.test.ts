import { describe, expect, it } from "vitest";

import { ConsultClient, ConsultError, expectedEcho, formatPartNumber, param, parseFaultCodes } from "@/protocol";
import type { Transport } from "@/transport";
import { ByteQueue } from "@/transport";

import { loadFixture, ReplayTransport } from "./helpers/replayTransport";

const FAST = { initTimeoutMs: 100, initAttempts: 2, byteTimeoutMs: 100, frameTimeoutMs: 100, quietMs: 20 };

describe("CP-1xx/2xx/3xx/4xx: replay of a real ECU log (OpenConsult log_01)", () => {
  it("runs init, part number, fault codes and a stream exactly as the real ECU expects", async () => {
    const transport = new ReplayTransport(loadFixture("openconsult-log_01.txt"));
    const client = new ConsultClient(transport, FAST);

    await client.init();
    expect(client.isConnected).toBe(true);

    const { partNumber } = await client.readPartNumber();
    expect(partNumber).toBe("23710-AA502 (ROM 1480)");

    const codes = await client.readFaultCodes();
    expect(codes).toEqual([expect.objectContaining({ code: 51, startsSinceObserved: 11 })]);

    const params = [param("rpm"), param("speed"), param("battery")];
    const frames: Array<Record<string, number | undefined>> = [];
    const handle = await client.stream(params, (v) => frames.push(v));
    await new Promise((r) => setTimeout(r, 20));
    await handle.stop();

    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect(frames[0]).toEqual({ rpm: 1462.5, speed: 0, battery: expect.closeTo(14.4, 5) });
    expect(transport.finished).toBe(true);
  });
});

describe("CP-103: command echo", () => {
  it("inverts command bytes and keeps data bytes", () => {
    expect(expectedEcho([0x5a, 0x00, 0x5a, 0x0c], 1)).toEqual([0xa5, 0x00, 0xa5, 0x0c]);
    expect(expectedEcho([0xd1], 0)).toEqual([0x2e]);
  });
});

describe("CP-202: part number formatting", () => {
  it("falls back to hex for short frames", () => {
    expect(formatPartNumber(Uint8Array.of(1, 2, 3))).toMatch(/^unknown/);
  });
});

describe("CP-301: fault code parsing", () => {
  it("drops code 55 (no malfunction)", () => {
    expect(parseFaultCodes(Uint8Array.of(55, 0))).toEqual([]);
  });
  it("reports unknown codes with their raw value", () => {
    expect(parseFaultCodes(Uint8Array.of(0xfa, 2))[0]).toMatchObject({ code: 250, startsSinceObserved: 2 });
  });
  it("rejects odd-length frames", () => {
    expect(() => parseFaultCodes(Uint8Array.of(1))).toThrow();
  });
});

describe("CP-102: init failure", () => {
  it("throws a helpful ConsultError when the ECU is silent", async () => {
    const q = new ByteQueue();
    const silent: Transport = {
      kind: "simulator",
      open: async () => {},
      close: async () => {},
      write: async () => {},
      read: (n, t) => q.read(n, t),
      drain: () => q.drain(),
    };
    await expect(new ConsultClient(silent, FAST).init()).rejects.toThrow(ConsultError);
  });
});
