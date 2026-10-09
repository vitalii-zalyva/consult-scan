/**
 * High-level session: connect, select control unit, detect supported registers,
 * stream pages, keep a rolling history. Serialises all ECU operations.
 * Spec: 004-live-dashboard (LD-1xx), 001 (CP-5xx), 008 (XD-3xx), 009 (CU-1xx)
 */
import type { Sample } from "@/analysis/evaluate";
import type { ConsultTimings, StreamHandle } from "@/protocol/consult";
import { ConsultClient, ConsultError, DEFAULT_TIMINGS } from "@/protocol/consult";
import type { FaultCodeReading } from "@/protocol/fault-codes";
import type { ParamDef, ParamValues, RawValues } from "@/protocol/registers";
import { pageParams, PARAMS, paramsForRegisters, registersOf, undocumentedParam } from "@/protocol/registers";
import type { UnitId } from "@/protocol/units";
import { UNIT_LIST, UNITS } from "@/protocol/units";
import type { Transport } from "@/transport/types";

import { HISTORY_LIMIT } from "./constants";
import type { SessionEvents, SessionState, UnitDetection } from "./types";

export class ConsultSession {
  readonly client: ConsultClient;
  partNumber = "";
  unit: UnitId = "engine";
  /** CU-102: units that answered the init sequence. */
  availableUnits: UnitId[] = ["engine"];
  latest: ParamValues = {};
  latestRaw: RawValues = {};
  history: Sample[] = [];
  state: SessionState = "disconnected";

  /** Set by a running procedure (power balance) so disconnect / unit switch stop it instead of waiting. */
  cancelProcedure: (() => void) | null = null;

  private detected = new Map<UnitId, UnitDetection>();
  private queue: Promise<unknown> = Promise.resolve();
  private stream: StreamHandle | null = null;
  private streaming = false;

  constructor(
    readonly transport: Transport,
    private readonly events: SessionEvents = {},
    timings: ConsultTimings = DEFAULT_TIMINGS,
  ) {
    this.client = new ConsultClient(transport, timings);
  }

  /** Mapped + undocumented params of the current unit that the unit answers. */
  get params(): ParamDef[] {
    const d = this.detected.get(this.unit);
    return d ? [...d.params, ...d.undocumented] : [];
  }

  get undocumented(): ParamDef[] {
    return this.detected.get(this.unit)?.undocumented ?? [];
  }

  async connect(): Promise<void> {
    this.setState("connecting");
    try {
      await this.transport.open();
      this.events.onProgress?.({ kind: "init" });
      await this.client.init();
      this.events.onProgress?.({ kind: "part-number" });
      this.partNumber = (await this.client.readPartNumber()).partNumber;
      await this.detect("engine");
      this.setState("idle");
    } catch (err) {
      this.setState("error", errorMessage(err));
      await this.transport.close().catch(() => undefined);
      throw err;
    }
  }

  /** CP-501: probe each known register of the unit once per connection. */
  private async detect(unitId: UnitId): Promise<UnitDetection> {
    const cached = this.detected.get(unitId);
    if (cached) return cached;
    const unit = UNITS[unitId];
    const registers = registersOf(unit.params);
    const supported = new Set<number>();
    for (const [i, reg] of registers.entries()) {
      this.events.onProgress?.({ kind: "detect", unit: unitId, i: i + 1, n: registers.length });
      if (await this.client.probeRegister(reg)) supported.add(reg);
    }
    let params = paramsForRegisters(supported, unit.params);
    // CP-502: an engine ECU that answers nothing to probes still gets the well-known set.
    if (!params.length && unitId === "engine") params = PARAMS.filter((p) => p.verified);
    const detection: UnitDetection = { params, undocumented: [] };
    this.detected.set(unitId, detection);
    return detection;
  }

  /** CU-102: try every known unit select byte; re-selects the current unit afterwards. */
  scanUnits(): Promise<UnitId[]> {
    return this.withStreamPaused(async () => {
      const found: UnitId[] = [];
      for (const unit of UNIT_LIST) {
        this.events.onProgress?.({ kind: "looking-for-unit", unit: unit.id });
        try {
          await this.client.init(unit.initByte, 1);
          found.push(unit.id);
        } catch {
          /* not present */
        }
      }
      await this.client.init(UNITS[this.unit].initByte);
      this.availableUnits = found.length ? found : ["engine"];
      this.events.onProgress?.({ kind: "units-found", units: this.availableUnits });
      return this.availableUnits;
    });
  }

  /** CU-101/CU-201: switch to another control unit and stream its data. */
  async selectUnit(unitId: UnitId): Promise<void> {
    if (unitId === this.unit) return;
    this.cancelProcedure?.();
    const wasStreaming = this.streaming;
    if (wasStreaming) await this.stopStreaming();
    this.setState("busy");
    try {
      await this.exclusive(async () => {
        await this.client.init(UNITS[unitId].initByte);
        this.unit = unitId;
        this.latest = {};
        this.latestRaw = {};
        this.history = [];
        await this.detect(unitId);
      });
    } finally {
      this.setState("idle");
    }
    if (wasStreaming) await this.startStreaming();
  }

  /**
   * XD-301..304: probe every address 0x00–0xFF that is not in the unit's map.
   * Returns the addresses that answered; they are streamed as raw values.
   */
  deepScan(signal?: AbortSignal): Promise<number[]> {
    return this.withStreamPaused(async () => {
      const detection = await this.detect(this.unit);
      const mapped = new Set(registersOf(UNITS[this.unit].params));
      const found: number[] = [];
      for (let reg = 0; reg <= 0xff; reg++) {
        if (signal?.aborted) break;
        this.events.onProgress?.({ kind: "deep-scan", i: reg + 1, found: found.length });
        if (mapped.has(reg)) continue;
        if (await this.client.probeRegister(reg)) found.push(reg);
      }
      if (!signal?.aborted) detection.undocumented = found.map(undocumentedParam);
      this.events.onProgress?.(
        signal?.aborted ? { kind: "deep-scan-cancelled" } : { kind: "deep-scan-done", found: found.length },
      );
      return found;
    });
  }

  /** XD-303: restore a previous deep-scan result without re-probing. */
  applyDeepScan(registers: readonly number[]): void {
    const detection = this.detected.get(this.unit);
    if (detection) detection.undocumented = registers.map(undocumentedParam);
  }

  /**
   * LD-102: stream all supported params. When they do not fit one frame
   * (20 registers), rotate through pages, `framesPerPage` frames each.
   */
  async startStreaming(framesPerPage = 6): Promise<void> {
    if (this.streaming) return;
    const pages = pageParams(this.params);
    if (!pages.length) return;
    this.streaming = true;
    this.setState("streaming");
    void this.exclusive(async () => {
      let pageIndex = 0;
      try {
        while (this.streaming) {
          const page = pages[pageIndex % pages.length]!;
          let frames = 0;
          let rotate!: () => void;
          const pageDone = new Promise<void>((r) => (rotate = r));
          this.stream = await this.client.stream(page, (values, raw) => {
            this.record(values, raw);
            if (!this.streaming || (pages.length > 1 && ++frames >= framesPerPage)) rotate();
          });
          if (!this.streaming) rotate();
          await Promise.race([pageDone, this.stream.done]);
          await this.stream.stop();
          this.stream = null;
          pageIndex++;
        }
        this.setState("idle");
      } catch (err) {
        this.streaming = false;
        this.stream = null;
        this.setState("error", errorMessage(err));
      }
    });
  }

  /** Merges a frame into the live state and history (also used by tests that stream themselves). */
  record(values: ParamValues, raw: RawValues = {}): Sample {
    this.latest = { ...this.latest, ...values };
    this.latestRaw = { ...this.latestRaw, ...raw };
    const sample: Sample = { t: Date.now(), values: { ...this.latest } };
    this.history.push(sample);
    if (this.history.length > HISTORY_LIMIT) this.history.splice(0, this.history.length - HISTORY_LIMIT);
    this.events.onSample?.(sample);
    return sample;
  }

  /** CY-206: run an ECU procedure with page streaming paused; streaming resumes afterwards. */
  runExclusive<T>(op: (client: ConsultClient) => Promise<T>): Promise<T> {
    return this.withStreamPaused(() => op(this.client));
  }

  get isStreaming(): boolean {
    return this.streaming;
  }

  async stopStreaming(): Promise<void> {
    this.streaming = false;
    await this.stream?.stop();
    await this.queue;
  }

  readFaultCodes(): Promise<FaultCodeReading[]> {
    return this.withStreamPaused(async () => {
      const codes = await this.client.readFaultCodes();
      if (this.unit === "engine") return codes;
      // CU-103: the engine description table does not apply to other units.
      const unit = UNITS[this.unit];
      return codes.map(({ code, startsSinceObserved }) => ({
        code,
        startsSinceObserved,
        name: `${unit.label} code ${code} — see FSM`,
      }));
    });
  }

  clearFaultCodes(): Promise<void> {
    if (!UNITS[this.unit].canClearCodes)
      return Promise.reject(new ConsultError("Clearing codes is only enabled for the engine ECU", "clear-not-allowed"));
    return this.withStreamPaused(() => this.client.clearFaultCodes());
  }

  async disconnect(): Promise<void> {
    this.cancelProcedure?.();
    await this.stopStreaming().catch(() => undefined);
    await this.transport.close();
    this.setState("disconnected");
  }

  private async withStreamPaused<T>(op: () => Promise<T>): Promise<T> {
    const wasStreaming = this.streaming;
    if (wasStreaming) await this.stopStreaming();
    this.setState("busy");
    try {
      return await this.exclusive(op);
    } finally {
      this.setState("idle");
      if (wasStreaming) void this.startStreaming();
    }
  }

  private exclusive<T>(op: () => Promise<T>): Promise<T> {
    const run = this.queue.then(op, op);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private setState(state: SessionState, message?: string): void {
    this.state = state;
    this.events.onState?.(state, message);
  }
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
