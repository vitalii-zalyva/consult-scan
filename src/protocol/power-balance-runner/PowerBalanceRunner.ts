/**
 * Runs the power balance active test with all safety interlocks.
 * Spec: specs/012-cylinder-health/spec.md (CY-1xx, CY-2xx, CY-3xx)
 *
 * Invariants:
 *  - whenever a cylinder may be cut, a restore (`0A 88 00`) is attempted before this runner returns;
 *  - after every cut — completed, aborted or failed — rpm recovery is verified (CY-205), and if it cannot be
 *    verified the result carries `restoreUnconfirmed` so the UI tells the user to cycle the ignition.
 */
import { mean } from "@/analysis/diagnosis";
import type { AbortReason, CutMeasurement, PowerBalanceResult } from "@/analysis/power-balance";
import { abortReason, analyzeCuts, checkInterlocks, hasRecovered, PB_LIMITS } from "@/analysis/power-balance";
import type { ConsultClient, StreamHandle } from "@/protocol/consult";
import { CMD, ConsultError, cylinderMask, CYLINDERS, POWER_BALANCE_REGISTER } from "@/protocol/consult";
import type { ParamDef, ParamValues } from "@/protocol/registers";
import { PARAMS } from "@/protocol/registers";
import type { ConsultSession } from "@/protocol/session";

import { DRY_RUN_CUT_MS, RESTORE_ATTEMPTS } from "./constants";
import type { Collected, PbEvents, PbLimits, PowerBalanceOptions } from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class PowerBalanceRunner {
  private abort: AbortReason | null = null;
  private wake: Array<() => void> = [];
  private cutMaybeActive = false;
  private running = false;

  constructor(
    private readonly session: ConsultSession,
    private readonly opts: PowerBalanceOptions,
    private readonly events: PbEvents = {},
    private readonly limits: PbLimits = PB_LIMITS,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  /** CY-204: user Stop, tab hidden, disconnect… The run loop restores, verifies and returns. */
  stop(reason: AbortReason = "user"): void {
    this.abort ??= reason;
    this.wake.splice(0).forEach((w) => w());
  }

  /**
   * CY-102: best-effort restore when the page is closing and we cannot await.
   * Sends STOP, then `0A 88 00 F0`, then STOP, without waiting for echoes.
   */
  emergencyRestore(): void {
    if (!this.cutMaybeActive) return;
    const t = this.session.transport;
    void t.write(Uint8Array.of(CMD.STOP));
    void t.write(Uint8Array.of(CMD.ACTIVE_TEST, POWER_BALANCE_REGISTER, 0x00, CMD.GO));
    void t.write(Uint8Array.of(CMD.STOP));
  }

  async run(): Promise<PowerBalanceResult> {
    if (this.running) throw new Error("Power balance test already running");
    this.running = true;
    // Disconnect / unit switch must stop the test instead of waiting for it to finish.
    this.session.cancelProcedure = () => this.stop("user");
    try {
      return await this.session.runExclusive((client) => this.execute(client));
    } finally {
      this.session.cancelProcedure = null;
      this.running = false;
    }
  }

  private params(): ParamDef[] {
    const available = new Set(this.session.params.map((p) => p.id));
    return PARAMS.filter((p) => ["rpm", "aac", "coolant", "speed", "bits13"].includes(p.id) && available.has(p.id));
  }

  private async execute(client: ConsultClient): Promise<PowerBalanceResult> {
    const o = this.opts;
    const L = this.limits;
    const dryRun = o.dryRun;
    const rounds = dryRun ? 1 : Math.min(Math.max(1, Math.round(o.rounds)), L.maxRounds);
    // CY-203: limits are enforced here, not by the caller.
    const cutMs = Math.min(dryRun ? DRY_RUN_CUT_MS : (o.cutMs ?? L.maxCutMs), L.maxCutMs);
    const pauseMs = L.minPauseMs;
    const measureMs = Math.min(L.measureWindowMs, cutMs);
    const restoreWithinMs = Math.min(L.restoreWithinMs, pauseMs);
    const cylinders = dryRun ? [1] : Array.from({ length: CYLINDERS }, (_, i) => i + 1);
    const params = this.params();
    if (!params.some((p) => p.id === "rpm")) throw new ConsultError("Engine speed is not available", "protocol");

    let mode: "combined" | "separate" = o.mode ?? "combined";
    let restoreUnconfirmed = false;
    const cuts: CutMeasurement[] = [];

    const firstWindow = (cut: Collected[]) => cut.filter((s) => s.t - (cut[0]?.t ?? 0) <= measureMs);

    /** One cut attempt followed — always — by restore and the CY-205 recovery check. */
    const cutRestoreVerify = async (
      cylinder: number,
      round: number,
      baselineRpm: number,
    ): Promise<{ cut: Collected[]; error: Error | null; safe: boolean }> => {
      this.events.onPhase?.({ kind: "cut", cylinder, round });
      let cut: Collected[] = [];
      let error: Error | null = null;
      try {
        cut = await this.collect(client, params, cutMs, { mask: cylinderMask(cylinder), mode });
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
      }
      this.events.onPhase?.({ kind: "restoring" });
      const restored = await this.restore(client);
      const rpms = firstWindow(cut).map((s) => s.v.rpm ?? 0);
      const dropRpm = rpms.length ? baselineRpm - mean(rpms)! : 0;
      this.events.onPhase?.({ kind: "recover", cylinder, round });
      let recovered = false;
      if (restored) {
        try {
          // Never shortened by Stop: the engine must be seen back at idle.
          const rec = await this.collect(client, params, pauseMs, null, true);
          recovered = hasRecovered(
            rec.map((s) => ({ t: s.t, rpm: s.v.rpm ?? 0 })),
            baselineRpm,
            dropRpm,
            restoreWithinMs,
          );
        } catch {
          recovered = false; // cannot observe the engine → cannot confirm
        }
      }
      return { cut, error, safe: restored && recovered };
    };

    try {
      outer: for (let round = 1; round <= rounds; round++) {
        for (const cylinder of cylinders) {
          if (this.abort) break outer;

          this.events.onPhase?.({ kind: "baseline", cylinder, round });
          const base = await this.collect(client, params, L.baselineMs, null);
          if (this.abort) break outer;
          // CY-201 re-checked on fresh data right before every cut (the UI check may be stale).
          const fresh = base.at(-1)?.v ?? {};
          if (
            this.session.unit !== "engine" ||
            checkInterlocks(fresh, { isEngine: true, busy: false }).blocked.length
          ) {
            this.abort = "interlock";
            break outer;
          }
          const baselineRpm = mean(base.map((s) => s.v.rpm ?? 0)) ?? 0;

          let attempt = await cutRestoreVerify(cylinder, round, baselineRpm);
          if (!attempt.safe) {
            restoreUnconfirmed = true;
            this.abort ??= "error";
            break outer;
          }
          // CY-103: combined request rejected → retry this cylinder once as cut-then-stream,
          // only after the full restore + recovery pause above.
          if (attempt.error) {
            const rejected = attempt.error instanceof ConsultError && attempt.error.code === "protocol";
            if (mode !== "combined" || !rejected || this.abort) throw attempt.error;
            mode = "separate";
            attempt = await cutRestoreVerify(cylinder, round, baselineRpm);
            if (!attempt.safe) {
              restoreUnconfirmed = true;
              this.abort ??= "error";
              break outer;
            }
            if (attempt.error) throw attempt.error;
          }
          if (this.abort) break outer;

          const w = firstWindow(attempt.cut);
          const r = w.map((s) => s.v.rpm ?? 0);
          if (r.length) {
            const m: CutMeasurement = {
              cylinder,
              round,
              baselineRpm,
              cutRpm: mean(r)!,
              minRpm: Math.min(...r),
              ...(base.some((s) => s.v.aac !== undefined) ? { aacBefore: mean(base.map((s) => s.v.aac ?? 0)) } : {}),
              ...(w.some((s) => s.v.aac !== undefined) ? { aacDuring: mean(w.map((s) => s.v.aac ?? 0)) } : {}),
            };
            cuts.push(m);
            this.events.onCut?.(m);
          }
        }
      }
    } catch (err) {
      this.abort ??= err instanceof Error && err.name === "TimeoutError" ? "timeout" : "error";
    } finally {
      if (this.cutMaybeActive && !(await this.restore(client))) restoreUnconfirmed = true;
      this.events.onPhase?.({ kind: "done" });
    }

    const { cylinders: results, inconclusive } = analyzeCuts(cuts);
    return {
      date: new Date().toISOString(),
      partNumber: this.session.partNumber,
      ...(o.odometerKm !== undefined ? { odometerKm: o.odometerKm } : {}),
      rounds,
      dryRun,
      cylinders: results,
      inconclusive,
      restoreUnconfirmed,
      mode,
      ...(this.abort ? { aborted: this.abort } : {}),
    };
  }

  /**
   * Streams params for `ms` (optionally with a cylinder cut), checking abort conditions on every frame.
   * `ignoreAbort` is used for the post-restore recovery window, which always runs its full length.
   */
  private async collect(
    client: ConsultClient,
    params: ParamDef[],
    ms: number,
    cut: { mask: number; mode: "combined" | "separate" } | null,
    ignoreAbort = false,
  ): Promise<Collected[]> {
    const out: Collected[] = [];
    let handle: StreamHandle;
    const onFrame = (v: ParamValues) => {
      const sample = this.session.record(v);
      out.push({ t: sample.t, v: sample.values });
      const reason = abortReason(sample.values);
      if (reason && !ignoreAbort) this.stop(reason);
    };
    if (cut) {
      this.cutMaybeActive = true;
      if (cut.mode === "combined") handle = await client.powerBalanceStream(cut.mask, params, onFrame);
      else {
        await client.setPowerBalance(cut.mask);
        handle = await client.stream(params, onFrame);
      }
    } else {
      handle = await client.stream(params, onFrame);
    }
    let wakeMe: (() => void) | null = null;
    try {
      // A Stop that arrived while the command was being sent must not wait out the whole cut.
      if (ignoreAbort || !this.abort) {
        const waits: Promise<unknown>[] = [sleep(ms), handle.done];
        if (!ignoreAbort) waits.push(new Promise<void>((r) => this.wake.push((wakeMe = r))));
        await Promise.race(waits);
      }
    } finally {
      this.wake = this.wake.filter((w) => w !== wakeMe);
      await handle.stop();
    }
    return out;
  }

  /** CY-102: `0A 88 00`, retried. Returns false if it could not be confirmed. */
  private async restore(client: ConsultClient): Promise<boolean> {
    for (let i = 0; i < RESTORE_ATTEMPTS; i++) {
      try {
        await client.resync();
        await client.setPowerBalance(0);
        this.cutMaybeActive = false;
        return true;
      } catch {
        await sleep(100);
      }
    }
    return false;
  }
}
