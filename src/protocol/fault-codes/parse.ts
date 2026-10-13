/**
 * Consult-I self-diagnostic (DTC) codes.
 * Spec: specs/006-fault-codes/spec.md
 * FC-101: the code byte carries the Nissan code as two hex digits (0x12 = code 12, MAF sensor;
 * 0x55 = 55, no malfunction), per PLMS "Consult Protocol & Commands Issue 6" and the A32 car
 * (byte 0x12 reported; decimal 18 is not a Nissan code). Bytes with a digit above 9 fall back to
 * their decimal value (FC-105) so the A/T table entries above 99 stay reachable.
 * FC-106: names follow the Nissan FSM EC section DTC index (1995 US Maxima, 2-digit codes; closest
 * available to the European A32 ECU): http://pdf.textfiles.com/manuals/AUTOMOBILE/NISSAN/maxima/1995/ec.pdf
 * Right bank = bank 1 (P0130), left bank = bank 2 (P0150).
 */
import { NO_MALFUNCTION } from "./constants";
import { BY_CODE } from "./table";
import type { FaultCodeInfo, FaultCodeReading } from "./types";

/**
 * FC-101: high nibble = tens, low nibble = units (0x12 → 12). FC-105: codes 100–159 use tens
 * 10–15 in the high nibble (0xA1 → 101; inferred, the only one-byte form consistent with FC-101);
 * a low nibble above 9 is not a digit, so such bytes fall back to their decimal value.
 */
export const decodeFaultByte = (byte: number): number => ((byte & 0x0f) <= 9 ? (byte >> 4) * 10 + (byte & 0x0f) : byte);

/** Inverse of decodeFaultByte (simulator). */
export const encodeFaultCode = (code: number): number =>
  code <= 159 ? (Math.floor(code / 10) << 4) | (code % 10) : code;

/** FC-103: unknown codes keep the raw byte visible. */
export function lookupFaultCode(code: number, byte = encodeFaultCode(code)): FaultCodeInfo {
  const raw = `0x${byte.toString(16).padStart(2, "0")}`;
  return BY_CODE.get(code) ?? { code, name: `Unknown code ${code} (raw ${raw})` };
}

/** Parses a D1 response frame: pairs of [code byte, startsSinceObserved]. Drops "55 no malfunction". */
export function parseFaultCodes(frame: Uint8Array): FaultCodeReading[] {
  if (frame.length % 2 !== 0) throw new Error(`Invalid fault code frame length ${frame.length}`);
  const out: FaultCodeReading[] = [];
  for (let i = 0; i < frame.length; i += 2) {
    const byte = frame[i]!;
    const code = decodeFaultByte(byte);
    if (code === NO_MALFUNCTION) continue;
    out.push({ ...lookupFaultCode(code, byte), startsSinceObserved: frame[i + 1]! });
  }
  return out;
}
