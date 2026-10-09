/**
 * Consult-I protocol client.
 * Spec: specs/001-consult-protocol/spec.md
 *
 * Wire summary (9600 8N1):
 *   init      FF FF EF            -> 10
 *   command   <cmd> [data]...     -> ECU echoes each command byte bit-inverted, data bytes as-is
 *   go        F0                  -> frames: FF <len> <len data bytes> (repeats while streaming)
 *   stop      30                  -> CF (frames already in flight may precede it)
 *   invalid command / unsupported register -> FE
 */
import type { FaultCodeReading } from "@/protocol/fault-codes";
import { parseFaultCodes } from "@/protocol/fault-codes";
import type { ParamDef, ParamValues, RawValues } from "@/protocol/registers";
import { decodeFrame } from "@/protocol/registers";
import { TimeoutError } from "@/transport/errors";
import type { Transport } from "@/transport/types";

import { expectedEcho, hex, registerCommand } from "./commands";
import { CMD, DEFAULT_TIMINGS } from "./constants";
import { ConsultError, UnsupportedRegisterError } from "./errors";
import { formatPartNumber } from "./partNumber";
import type { ConsultTimings, StreamHandle } from "./types";

/**
 * One command at a time; callers must not overlap operations
 * (the UI serialises them through ConsultSession).
 */
export class ConsultClient {
  private connected = false;

  constructor(
    private readonly transport: Transport,
    private readonly timings: ConsultTimings = DEFAULT_TIMINGS,
  ) {}

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * CP-101..CP-104: send FF FF <unit> until the unit answers 10.
   * CU-101: the third byte selects the control unit (EF engine, EA A/T, DF climate…).
   */
  async init(unitByte: number = CMD.ENGINE_UNIT, attempts = this.timings.initAttempts): Promise<void> {
    this.connected = false;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      this.transport.drain();
      // A previous session may have left the ECU streaming; stop it first.
      await this.transport.write(Uint8Array.of(CMD.STOP));
      await this.skipUntilQuiet(this.timings.quietMs);
      await this.transport.write(Uint8Array.from([...CMD.INIT_PREFIX, unitByte]));
      const deadline = Date.now() + this.timings.initTimeoutMs;
      try {
        while (Date.now() < deadline) {
          const [b] = await this.transport.read(1, Math.max(1, deadline - Date.now()));
          if (b === CMD.INIT_ACK) {
            this.connected = true;
            return;
          }
        }
      } catch (err) {
        if (!(err instanceof TimeoutError)) throw err;
      }
    }
    if (unitByte !== CMD.ENGINE_UNIT) {
      const b = unitByte.toString(16).toUpperCase();
      throw new ConsultError(`Control unit 0x${b} did not answer the init sequence.`, "unit-init-failed", b);
    }
    throw new ConsultError(
      "ECU did not answer the init sequence. Check ignition is ON, the cable is in the 14-pin Consult socket, and the right serial port is selected.",
      "init-failed",
    );
  }

  /** CP-201: ECU part number, formatted like the FSM label, e.g. "2114 23710-0A503". */
  async readPartNumber(): Promise<{ partNumber: string; raw: Uint8Array }> {
    await this.command([CMD.ECU_PART_NUMBER]);
    const frame = await this.readFrame();
    await this.halt();
    return { partNumber: formatPartNumber(frame), raw: frame };
  }

  /** CP-301: read stored self-diagnostic codes. */
  async readFaultCodes(): Promise<FaultCodeReading[]> {
    await this.command([CMD.READ_FAULT_CODES]);
    const frame = await this.readFrame();
    await this.halt();
    return parseFaultCodes(frame);
  }

  /** CP-302: erase stored codes. Caller must have the user's confirmation. */
  async clearFaultCodes(): Promise<void> {
    await this.command([CMD.CLEAR_FAULT_CODES]);
    await this.halt();
  }

  /** CP-501: returns true if the ECU accepts a read of this register. */
  async probeRegister(register: number): Promise<boolean> {
    try {
      await this.command([CMD.READ_REGISTER, register], 1);
      await this.readFrame();
      await this.halt();
      return true;
    } catch (err) {
      // A timeout also means "unsupported": register 0xFE echoes as FE, which is indistinguishable
      // from the "invalid" reply, and some ECUs may simply stay silent.
      if (err instanceof UnsupportedRegisterError || err instanceof TimeoutError) {
        await this.recover();
        return false;
      }
      throw err;
    }
  }

  /** Reads one frame of the given params (single-shot). */
  async readParams(params: readonly ParamDef[]): Promise<ParamValues> {
    await this.command(registerCommand(params), 1);
    const frame = await this.readFrame();
    await this.halt();
    return decodeFrame(params, frame).values;
  }

  /**
   * CP-401..CP-404: start a continuous stream. `onFrame` is called for every frame.
   * The stream runs until stop() is called or a transport error occurs.
   */
  async stream(
    params: readonly ParamDef[],
    onFrame: (values: ParamValues, raw: RawValues) => void,
  ): Promise<StreamHandle> {
    await this.command(registerCommand(params), 1);
    let stopSent: Promise<void> | null = null;

    // Single reader: frames until stop is requested, then frames-in-flight until CF.
    const done = (async () => {
      for (;;) {
        const [b] = await this.transport.read(1, this.timings.frameTimeoutMs);
        if (stopSent && b === CMD.STOP_ACK) return;
        if (b !== CMD.FRAME_START) continue;
        const [len] = await this.transport.read(1, this.timings.byteTimeoutMs);
        const frame = len ? await this.transport.read(len, this.timings.byteTimeoutMs + len * 2) : new Uint8Array();
        if (!stopSent) {
          const decoded = decodeFrame(params, frame);
          onFrame(decoded.values, decoded.raw);
        }
      }
    })();

    return {
      done,
      stop: async () => {
        stopSent ??= this.transport.write(Uint8Array.of(CMD.STOP));
        await stopSent;
        await done;
      },
    };
  }

  /** Sends a command, verifies the echo, then sends GO. */
  private async command(request: number[], dataWidth = 0): Promise<void> {
    const expected = expectedEcho(request, dataWidth);
    this.transport.drain();
    await this.transport.write(Uint8Array.from(request));
    // Read byte-by-byte: an unsupported register is answered with a single FE.
    const echo: number[] = [];
    for (let i = 0; i < expected.length; i++) {
      const [b] = await this.transport.read(1, this.timings.byteTimeoutMs);
      echo.push(b!);
      if (b === expected[i]) continue;
      if (b === CMD.INVALID) {
        if (request[0] === CMD.READ_REGISTER && dataWidth === 1) {
          // (5A, reg) pairs: the register of the failing pair is at the odd index.
          throw new UnsupportedRegisterError(request[i - (i % 2) + 1]!);
        }
        throw new ConsultError(`ECU rejected command ${hex(request)}`);
      }
      throw new ConsultError(`Unexpected echo: sent ${hex(request)}, expected ${hex(expected)}, got ${hex(echo)}`);
    }
    await this.transport.write(Uint8Array.of(CMD.GO));
  }

  private async readFrame(): Promise<Uint8Array> {
    // Resync: skip anything until a frame start byte.
    for (let skipped = 0; ; skipped++) {
      const [b] = await this.transport.read(1, this.timings.frameTimeoutMs);
      if (b === CMD.FRAME_START) break;
      if (skipped > 64) throw new ConsultError("Lost frame sync (no 0xFF start byte)");
    }
    const [len] = await this.transport.read(1, this.timings.byteTimeoutMs);
    if (len === undefined) throw new ConsultError("Missing frame length");
    return len === 0 ? new Uint8Array() : this.transport.read(len, this.timings.byteTimeoutMs + len * 2);
  }

  /** Sends STOP and consumes trailing frames until CF. */
  private async halt(): Promise<void> {
    await this.transport.write(Uint8Array.of(CMD.STOP));
    for (let frames = 0; frames < 32; frames++) {
      const [b] = await this.transport.read(1, this.timings.frameTimeoutMs);
      if (b === CMD.STOP_ACK) return;
      if (b !== CMD.FRAME_START) continue;
      const [len] = await this.transport.read(1, this.timings.byteTimeoutMs);
      if (len) await this.transport.read(len, this.timings.byteTimeoutMs + len * 2);
    }
    throw new ConsultError("ECU did not acknowledge stop (0xCF)");
  }

  /** Best-effort return to idle after an error. */
  private async recover(): Promise<void> {
    await this.transport.write(Uint8Array.of(CMD.STOP));
    await this.skipUntilQuiet(this.timings.quietMs);
  }

  private async skipUntilQuiet(quietMs: number): Promise<void> {
    for (let i = 0; i < 256; i++) {
      try {
        await this.transport.read(1, quietMs);
      } catch (err) {
        if (err instanceof TimeoutError) return;
        throw err;
      }
    }
  }
}
