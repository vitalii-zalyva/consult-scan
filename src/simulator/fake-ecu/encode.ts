// Spec: specs/003-ecu-simulator/spec.md (SIM-1xx), 008 (deep scan), 009 (control units)
import type { ParamDef, ParamValues } from "@/protocol/registers";

/**
 * Inverts a decoder: the param's own `encode` when it has one, else the linear
 * inverse raw = (value - decode(0)) / step.
 */
export function encodeParam(p: ParamDef, value: number): number[] {
  if (p.encode) return p.encode(value);
  const n = p.registers.length;
  const zero = p.decode(new Array<number>(n).fill(0));
  const one = p.decode(n === 1 ? [1] : [...new Array<number>(n - 1).fill(0), 1]);
  const step = one - zero || 1;
  const max = 2 ** (8 * n) - 1;
  const raw = Math.max(0, Math.min(max, Math.round((value - zero) / step)));
  return Array.from({ length: n }, (_, i) => (raw >> (8 * (n - 1 - i))) & 0xff);
}

/** Register address -> byte value for a set of decoded values. */
export function registerSnapshot(values: ParamValues, params: readonly ParamDef[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of params) {
    const v = values[p.id];
    if (v === undefined) continue;
    encodeParam(p, v).forEach((byte, i) => out.set(p.registers[i]!, byte));
  }
  return out;
}
