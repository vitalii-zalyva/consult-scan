/**
 * Consult-I self-diagnostic (DTC) codes.
 * Spec: specs/006-fault-codes/spec.md
 * The ECU reports the code as a raw byte whose *decimal* value is the Nissan code
 * (e.g. 0x0C = 12 = MAF sensor), per OpenConsult. Code 55 means "no malfunction".
 */
import { NO_MALFUNCTION } from "./constants";
import { BY_CODE } from "./table";
import type { FaultCodeInfo, FaultCodeReading } from "./types";

export function lookupFaultCode(code: number): FaultCodeInfo {
  const raw = `0x${code.toString(16).padStart(2, "0")}`;
  return BY_CODE.get(code) ?? { code, name: `Unknown code ${code} (raw ${raw})` };
}

/** Parses a D1 response frame: pairs of [code, startsSinceObserved]. Drops "55 no malfunction". */
export function parseFaultCodes(frame: Uint8Array): FaultCodeReading[] {
  if (frame.length % 2 !== 0) throw new Error(`Invalid fault code frame length ${frame.length}`);
  const out: FaultCodeReading[] = [];
  for (let i = 0; i < frame.length; i += 2) {
    const code = frame[i]!;
    if (code === NO_MALFUNCTION) continue;
    out.push({ ...lookupFaultCode(code), startsSinceObserved: frame[i + 1]! });
  }
  return out;
}
