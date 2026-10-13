/**
 * Byte-accurate fake Consult-I ECU, so the whole app runs without a car.
 * Spec: specs/003-ecu-simulator/spec.md (SIM-1xx), 008 (deep scan), 009 (control units)
 */
import { CMD } from "@/protocol/consult";
import { encodeFaultCode, NO_MALFUNCTION } from "@/protocol/fault-codes";
import type { UnitId } from "@/protocol/units";
import { UNIT_LIST, UNITS } from "@/protocol/units";
import type { EngineState } from "@/simulator/engine-model";
import { atValues, createEngineState, engineValues, stepEngine } from "@/simulator/engine-model";

import { SAMPLE_PART_NUMBER_FRAME, SIM_AT_REGISTERS, SIM_SUPPORTED_REGISTERS } from "./constants";
import { registerSnapshot } from "./encode";
import type { FakeEcuOptions, Pending } from "./types";

export class FakeEcu {
  readonly engine: EngineState = createEngineState();
  faultCodes: Array<[number, number]>;
  /** CY-702: the ECU acknowledges a restore but keeps the cylinder cut. */
  ignoreRestore = false;
  /** Rejects `0A` combined with `5A` (forces the CY-103 fallback path). */
  rejectCombinedActiveTest = false;
  /** Fault: ignores STOP (`30`) and keeps streaming without CF — tests bounded waits. */
  ignoreStop = false;
  atFaultCodes: Array<[number, number]> = [];
  private readonly supported: ReadonlySet<number>;
  private readonly frameIntervalMs: number;
  private readonly units: ReadonlySet<UnitId>;

  private unit: UnitId | null = null;
  private initWindow: number[] = [];
  private expectRegister = false;
  /** Bytes still expected after `0A` (register, data). */
  private activeTestBytes: number[] | null = null;
  private pending: Pending | null = null;
  private streamTimer: ReturnType<typeof setInterval> | null = null;
  private engineTimer: ReturnType<typeof setInterval> | null = null;
  private lastStep = 0;

  constructor(
    private readonly emit: (bytes: Uint8Array) => void,
    opts: FakeEcuOptions = {},
  ) {
    this.supported = opts.supported ?? SIM_SUPPORTED_REGISTERS;
    this.frameIntervalMs = opts.frameIntervalMs ?? 40;
    this.faultCodes = opts.faultCodes ?? [[34, 3]];
    this.units = new Set(opts.units ?? ["engine", "at"]);
  }

  start(): void {
    this.lastStep = Date.now();
    this.engineTimer = setInterval(() => {
      const now = Date.now();
      stepEngine(this.engine, (now - this.lastStep) / 1000);
      this.lastStep = now;
    }, 50);
  }

  stop(): void {
    if (this.engineTimer) clearInterval(this.engineTimer);
    this.stopStream();
  }

  receive(bytes: Uint8Array): void {
    for (const b of bytes) this.onByte(b);
  }

  private registersFor(unit: UnitId): ReadonlySet<number> {
    return unit === "engine" ? this.supported : unit === "at" ? SIM_AT_REGISTERS : new Set();
  }

  private onByte(b: number): void {
    this.initWindow = [...this.initWindow.slice(-2), b];
    const [w0, w1, w2] = this.initWindow;
    if (w0 === 0xff && w1 === 0xff && w2 !== undefined && w2 !== 0xff) {
      const unit = UNIT_LIST.find((u) => u.initByte === w2);
      if (unit && this.units.has(unit.id)) {
        this.stopStream();
        this.pending = null;
        this.expectRegister = false;
        this.unit = unit.id;
        this.emit(Uint8Array.of(CMD.INIT_ACK));
        return;
      }
      if (unit) {
        // CU-102: a unit that is not fitted stays silent.
        this.unit = null;
        return;
      }
    }
    if (!this.unit) return;

    if (this.activeTestBytes) {
      this.activeTestBytes.push(b);
      if (this.activeTestBytes.length === 1) {
        // CY-104: only the power-balance register exists in this simulator.
        if (b !== 0x88 || this.unit !== "engine") {
          this.activeTestBytes = null;
          this.emit(Uint8Array.of(CMD.INVALID));
          return;
        }
        this.emit(Uint8Array.of(b));
        return;
      }
      const mask = b;
      this.activeTestBytes = null;
      this.pending = { kind: "active", cutMask: mask };
      this.emit(Uint8Array.of(b));
      return;
    }

    if (this.expectRegister) {
      this.expectRegister = false;
      if (!this.registersFor(this.unit).has(b)) {
        this.emit(Uint8Array.of(CMD.INVALID));
        this.pending = null;
        return;
      }
      if (this.pending?.kind === "active") {
        if (this.rejectCombinedActiveTest) {
          this.pending = null;
          this.emit(Uint8Array.of(CMD.INVALID));
          return;
        }
        this.pending = { kind: "registers", registers: [], cutMask: this.pending.cutMask };
      }
      if (this.pending?.kind !== "registers") this.pending = { kind: "registers", registers: [] };
      this.pending.registers.push(b);
      this.emit(Uint8Array.of(b));
      return;
    }

    switch (b) {
      case CMD.READ_REGISTER:
        this.emit(Uint8Array.of(~b & 0xff));
        this.expectRegister = true;
        return;
      case CMD.ACTIVE_TEST:
        this.emit(Uint8Array.of(~b & 0xff));
        this.activeTestBytes = [];
        return;
      case CMD.ECU_PART_NUMBER:
        this.pending = { kind: "part" };
        this.emit(Uint8Array.of(~b & 0xff));
        return;
      case CMD.READ_FAULT_CODES:
        this.pending = { kind: "dtc" };
        this.emit(Uint8Array.of(~b & 0xff));
        return;
      case CMD.CLEAR_FAULT_CODES:
        this.pending = { kind: "clear" };
        this.emit(Uint8Array.of(~b & 0xff));
        return;
      case CMD.GO:
        this.go();
        return;
      case CMD.STOP:
        if (this.ignoreStop) return;
        this.stopStream();
        this.pending = null;
        this.emit(Uint8Array.of(CMD.STOP_ACK));
        return;
      case 0xff:
        return; // part of an init sequence
      default:
        if (UNIT_LIST.some((u) => u.initByte === b)) return;
        this.emit(Uint8Array.of(CMD.INVALID));
    }
  }

  private snapshot(): Map<number, number> {
    if (this.unit === "at") return registerSnapshot(atValues(this.engine), UNITS.at.params);
    const snap = registerSnapshot(engineValues(this.engine), UNITS.engine.params);
    snap.set(0x45, Math.round(this.engine.t * 10) & 0xff); // undocumented counter
    return snap;
  }

  private go(): void {
    const p = this.pending;
    if (!p) return;
    if (p.kind === "clear") {
      if (this.unit === "engine") this.faultCodes = [];
      return;
    }
    if (p.kind === "active" || (p.kind === "registers" && p.cutMask !== undefined)) {
      // CY-701: the cut persists until explicitly restored or the ECU is re-initialised/powered.
      this.applyCut(p.cutMask!);
      if (p.kind === "active") return;
    }
    const codes = this.unit === "at" ? this.atFaultCodes : this.faultCodes;
    const frame = (): number[] => {
      if (p.kind === "part") return SAMPLE_PART_NUMBER_FRAME;
      // FC-101: code numbers go on the wire as hex digits.
      if (p.kind === "dtc")
        return codes.length ? codes.flatMap(([c, n]) => [encodeFaultCode(c), n]) : [encodeFaultCode(NO_MALFUNCTION), 0];
      const snap = this.snapshot();
      return p.registers.map((r) => snap.get(r) ?? 0);
    };
    const send = () => {
      const data = frame();
      this.emit(Uint8Array.from([CMD.FRAME_START, data.length, ...data]));
    };
    this.stopStream();
    send();
    this.streamTimer = setInterval(send, this.frameIntervalMs);
  }

  private applyCut(mask: number): void {
    if (mask === 0 && this.ignoreRestore) return;
    if (mask !== this.engine.cutMask) this.engine.cutSince = this.engine.t;
    this.engine.cutMask = mask;
  }

  private stopStream(): void {
    if (this.streamTimer) clearInterval(this.streamTimer);
    this.streamTimer = null;
  }
}
