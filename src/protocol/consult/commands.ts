// Spec: specs/001-consult-protocol/spec.md
import type { ParamDef } from "@/protocol/registers";

import { CMD } from "./constants";

export const hex = (bytes: Iterable<number>) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ");

/** Command bytes are echoed bit-inverted; data bytes (register addresses) echo unchanged. */
export function expectedEcho(request: readonly number[], dataWidth: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < request.length;) {
    out.push(~request[i]! & 0xff);
    i++;
    for (let d = 0; d < dataWidth && i < request.length; d++, i++) out.push(request[i]!);
  }
  return out;
}

export function registerCommand(params: readonly ParamDef[]): number[] {
  return params.flatMap((p) => p.registers.flatMap((r) => [CMD.READ_REGISTER, r]));
}
