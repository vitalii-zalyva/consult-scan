import { afterEach, describe, expect, it } from "vitest";

import type { CutMeasurement } from "@/analysis";
import { analyzeCuts, checkInterlocks } from "@/analysis";
import type { PbLimits } from "@/protocol";
import { assertPowerBalanceMask, ConsultSession, cylinderMask, PowerBalanceRunner } from "@/protocol";
import { SimulatorTransport } from "@/transport";

const FAST_TIMINGS = { initTimeoutMs: 300, initAttempts: 2, byteTimeoutMs: 200, frameTimeoutMs: 400, quietMs: 15 };
/** Shortened limits for tests only; production always uses PB_LIMITS. */
const FAST_LIMITS: PbLimits = {
  maxCutMs: 600,
  minPauseMs: 700,
  baselineMs: 300,
  measureWindowMs: 600,
  restoreWithinMs: 700,
  maxRounds: 2,
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// These suites drive the simulator in real time with sub-second measurement windows. Under CPU load a window can
// come up short, so they retry before failing; the logic tests above them run once.
const REAL_TIME = { retry: 2 };

let transport: SimulatorTransport | null = null;
afterEach(async () => {
  await transport?.close();
  transport = null;
});

/** Warm, idling simulated engine with a connected session. */
async function warmSession(setup?: (t: SimulatorTransport) => void) {
  transport = new SimulatorTransport({ frameIntervalMs: 10 });
  transport.ecu.engine.coolant = 85;
  setup?.(transport);
  const session = new ConsultSession(transport, {}, FAST_TIMINGS);
  await session.connect();
  await session.startStreaming();
  await wait(1800); // idle rpm settles
  return { session, ecu: transport.ecu };
}

describe("CY-101/104: mask safety", () => {
  it("accepts 0 and single cylinders only", () => {
    expect(() => assertPowerBalanceMask(0)).not.toThrow();
    for (let c = 1; c <= 6; c++) expect(() => assertPowerBalanceMask(cylinderMask(c))).not.toThrow();
    for (const bad of [0b11, 0b101, 0x40, 0x80, 0xff, -1, 1.5])
      expect(() => assertPowerBalanceMask(bad)).toThrow(/only one cylinder/);
    expect(() => cylinderMask(7)).toThrow();
    expect(() => cylinderMask(0)).toThrow();
  });
});

describe("CY-201: interlocks", () => {
  const warmIdle = { rpm: 700, coolant: 85, speed: 0, bits13: 0b100 };
  it("allows warm idle in P/N", () =>
    expect(checkInterlocks(warmIdle, { isEngine: true, busy: false })).toEqual({ blocked: [], warnings: [] }));
  it.each([
    [{ ...warmIdle, coolant: 50 }, "cold"],
    [{ ...warmIdle, rpm: 1500 }, "rpm-range"],
    [{ ...warmIdle, rpm: 400 }, "rpm-range"],
    [{ ...warmIdle, speed: 10 }, "moving"],
    [{}, "no-data"],
  ] as const)("%o blocks with %s", (v, reason) => {
    expect(checkInterlocks(v, { isEngine: true, busy: false }).blocked).toContain(reason);
  });
  it("blocks on other units and while busy; warns if not in P/N", () => {
    expect(checkInterlocks(warmIdle, { isEngine: false, busy: true }).blocked).toEqual(["not-engine", "busy"]);
    expect(checkInterlocks({ ...warmIdle, bits13: 0 }, { isEngine: true, busy: false }).warnings).toEqual([
      "not-in-park-neutral",
    ]);
  });
});

describe("CY-305: analysis", () => {
  const cut = (cylinder: number, drop: number): CutMeasurement => ({
    cylinder,
    round: 1,
    baselineRpm: 700,
    cutRpm: 700 - drop,
    minRpm: 700 - drop - 10,
  });
  it("flags a weak cylinder relative to the median of the others", () => {
    const r = analyzeCuts([cut(1, 80), cut(2, 75), cut(3, 20), cut(4, 82), cut(5, 50), cut(6, 78)]);
    expect(r.cylinders.map((c) => c.status)).toEqual(["ok", "ok", "bad", "ok", "warn", "ok"]);
    expect(r.inconclusive).toBe(false);
  });
  it("is inconclusive when nothing drops", () => {
    const r = analyzeCuts([1, 2, 3, 4, 5, 6].map((c) => cut(c, 15)));
    expect(r.inconclusive).toBe(true);
    expect(r.cylinders.every((c) => c.status === "ok")).toBe(true);
  });
});

describe("CY-1xx/3xx: full run on the simulator", REAL_TIME, () => {
  it("finds the weak cylinder, restores firing, and resumes streaming", async () => {
    const { session, ecu } = await warmSession((t) => (t.ecu.engine.weakCylinder = 4));
    const phases: string[] = [];
    const result = await new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1 },
      { onPhase: (p) => phases.push(p.kind) },
      FAST_LIMITS,
    ).run();

    expect(result.aborted).toBeUndefined();
    expect(result.restoreUnconfirmed).toBe(false);
    expect(result.mode).toBe("combined");
    expect(result.cylinders).toHaveLength(6);
    expect(result.cylinders.find((c) => c.cylinder === 4)?.status).toBe("bad");
    expect(result.cylinders.filter((c) => c.status !== "ok").map((c) => c.cylinder)).toEqual([4]);
    expect(ecu.engine.cutMask).toBe(0);
    expect(phases.at(-1)).toBe("done");
    expect(session.isStreaming).toBe(true);
    await session.stopStreaming();
  }, 30_000);

  it("CY-207: dry run cuts only cylinder 1", async () => {
    const { session, ecu } = await warmSession();
    const cutCyls: number[] = [];
    const result = await new PowerBalanceRunner(
      session,
      { dryRun: true, rounds: 2 },
      { onCut: (m) => cutCyls.push(m.cylinder) },
      FAST_LIMITS,
    ).run();
    expect(result.dryRun).toBe(true);
    expect(cutCyls).toEqual([1]);
    expect(result.cylinders[0]!.dropRpm).toBeGreaterThan(30);
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);

  it("CY-103: falls back to cut-then-stream when the combined request is rejected", async () => {
    const { session, ecu } = await warmSession((t) => (t.ecu.rejectCombinedActiveTest = true));
    const result = await new PowerBalanceRunner(session, { dryRun: true, rounds: 1 }, {}, FAST_LIMITS).run();
    expect(result.mode).toBe("separate");
    expect(result.cylinders).toHaveLength(1);
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);
});

describe("CY-2xx: aborts always restore", REAL_TIME, () => {
  it("CY-204: stall risk aborts and restores", async () => {
    const { session, ecu } = await warmSession((t) => (t.ecu.engine.stallOnCut = true));
    const result = await new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1 },
      {},
      { ...FAST_LIMITS, maxCutMs: 2000 },
    ).run();
    expect(result.aborted).toBe("stall-risk");
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);

  it("CY-204: user stop during a cut restores", async () => {
    const { session, ecu } = await warmSession();
    const runner = new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1 },
      {
        onPhase: (p) => {
          if (p.kind === "cut") setTimeout(() => runner.stop("user"), 150);
        },
      },
      { ...FAST_LIMITS, maxCutMs: 3000 },
    );
    const result = await runner.run();
    expect(result.aborted).toBe("user");
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);

  it("CY-205: rpm not recovering (ECU ignores restore) → restoreUnconfirmed", async () => {
    const { session } = await warmSession((t) => (t.ecu.ignoreRestore = true));
    const tx: string[] = [];
    session.transport.onTraffic = (dir, b) =>
      dir === "tx" && tx.push([...b].map((x) => x.toString(16).padStart(2, "0")).join(""));
    const result = await new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1 },
      {},
      { ...FAST_LIMITS, maxCutMs: 1500, measureWindowMs: 1500 },
    ).run();
    expect(result.restoreUnconfirmed).toBe(true);
    expect(result.aborted).toBe("error");
    // Stopped after the first cylinder: no cut command for cylinders 2–6 was ever sent.
    expect(tx.filter((x) => x.startsWith("0a88") && !x.startsWith("0a8800") && !x.startsWith("0a8801"))).toEqual([]);
    await session.stopStreaming();
  }, 20_000);

  it("CY-102: emergency restore writes 0A 88 00 F0 when a cut may be active", async () => {
    const { session, ecu } = await warmSession();
    const runner = new PowerBalanceRunner(
      session,
      { dryRun: true, rounds: 1 },
      {
        onPhase: (p) => {
          if (p.kind === "cut")
            setTimeout(() => {
              runner.emergencyRestore();
            }, 200);
        },
      },
      { ...FAST_LIMITS, maxCutMs: 2000 },
    );
    const sent: string[] = [];
    session.transport.onTraffic = (dir, b) =>
      dir === "tx" && sent.push([...b].map((x) => x.toString(16).padStart(2, "0")).join(""));
    await runner.run();
    expect(sent).toContain("0a8800f0");
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);
});

/** Starts a run and applies `fault` once the first cut begins. */
async function runWithFaultDuringCut(
  setup: Parameters<typeof warmSession>[0],
  fault: (ecu: SimulatorTransport["ecu"], session: ConsultSession, runner: PowerBalanceRunner) => void,
  limits: PbLimits = { ...FAST_LIMITS, maxCutMs: 2000 },
) {
  const { session, ecu } = await warmSession(setup);
  const tx: string[] = [];
  session.transport.onTraffic = (dir, b) =>
    dir === "tx" && tx.push([...b].map((x) => x.toString(16).padStart(2, "0")).join(""));
  let fired = false;
  const runner: PowerBalanceRunner = new PowerBalanceRunner(
    session,
    { dryRun: false, rounds: 1 },
    {
      onPhase: (p) => {
        if (p.kind === "cut" && !fired) {
          fired = true;
          setTimeout(() => fault(ecu, session, runner), 150);
        }
      },
    },
    limits,
  );
  const result = await runner.run();
  return { result, ecu, session, tx };
}

describe("Safety review fixes", REAL_TIME, () => {
  it("CY-204: vehicle moving aborts and restores", async () => {
    const { result, ecu, session } = await runWithFaultDuringCut(undefined, (e) => (e.engine.speed = 20));
    expect(result.aborted).toBe("moving");
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);

  it("CY-204: overheating aborts and restores", async () => {
    const { result, ecu, session } = await runWithFaultDuringCut(undefined, (e) => {
      e.engine.coolant = 110;
      e.engine.faults.add("overheat");
    });
    expect(result.aborted).toBe("overheat");
    expect(ecu.engine.cutMask).toBe(0);
    await session.stopStreaming();
  }, 20_000);

  it("CY-205: user Stop + ECU ignoring restore is still detected (recovery check is never skipped)", async () => {
    const { result, session } = await runWithFaultDuringCut(
      (t) => (t.ecu.ignoreRestore = true),
      (_, __, r) => r.stop("user"),
    );
    expect(result.aborted).toBe("user");
    expect(result.restoreUnconfirmed).toBe(true);
    await session.stopStreaming().catch(() => undefined);
  }, 20_000);

  it("blocker: ECU that ignores STOP cannot hang the test; result says restore unconfirmed", async () => {
    const { result } = await runWithFaultDuringCut(undefined, (e) => (e.ignoreStop = true));
    expect(result.restoreUnconfirmed).toBe(true);
    expect(result.aborted).toBeDefined();
  }, 30_000);

  it("CY-204: transport lost mid-cut → returns with restore unconfirmed", async () => {
    const { result } = await runWithFaultDuringCut(undefined, (_, s) => void s.transport.close());
    expect(result.restoreUnconfirmed).toBe(true);
  }, 30_000);

  it("disconnect during the test stops it and restores before closing", async () => {
    const { session, ecu } = await warmSession();
    const tx: string[] = [];
    session.transport.onTraffic = (dir, b) =>
      dir === "tx" && tx.push([...b].map((x) => x.toString(16).padStart(2, "0")).join(""));
    const runner = new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1 },
      {},
      { ...FAST_LIMITS, maxCutMs: 3000 },
    );
    const pending = runner.run();
    await wait(FAST_LIMITS.baselineMs + 400); // inside the first cut
    const cutBefore = ecu.engine.cutMask;
    await session.disconnect();
    const result = await pending;
    expect(cutBefore).not.toBe(0);
    expect(result.aborted).toBe("user");
    expect(tx).toContain("0a8800"); // restore was sent before the port closed
  }, 30_000);

  it("CY-201: interlocks are re-checked on fresh data — a cold engine is never cut", async () => {
    const { session, ecu } = await warmSession();
    ecu.engine.coolant = 40; // UI state may be stale; the runner must notice
    await wait(300);
    const tx: string[] = [];
    session.transport.onTraffic = (dir, b) =>
      dir === "tx" && tx.push([...b].map((x) => x.toString(16).padStart(2, "0")).join(""));
    const result = await new PowerBalanceRunner(session, { dryRun: false, rounds: 1 }, {}, FAST_LIMITS).run();
    expect(result.aborted).toBe("interlock");
    expect(tx.some((x) => /^0a88(0[1-9a-f]|[1-3][0-9a-f])/.test(x))).toBe(false);
    await session.stopStreaming();
  }, 20_000);

  it("CY-203: requested cut length is clamped to the limit", async () => {
    const { session } = await warmSession();
    let cutStart = 0;
    let cutEnd = 0;
    await new PowerBalanceRunner(
      session,
      { dryRun: false, rounds: 1, cutMs: 60_000 },
      {
        onPhase: (p) => {
          if (p.kind === "cut" && !cutStart) cutStart = Date.now();
          if (p.kind === "restoring" && !cutEnd) cutEnd = Date.now();
        },
      },
      FAST_LIMITS,
    ).run();
    expect(cutEnd - cutStart).toBeLessThan(FAST_LIMITS.maxCutMs + 500);
    await session.stopStreaming();
  }, 30_000);
});
