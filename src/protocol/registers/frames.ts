// Spec: specs/001-consult-protocol/spec.md (CP-4xx), specs/008-extended-data/spec.md (XD-1xx, XD-2xx)
import { MAX_REGISTERS_PER_STREAM } from "./constants";
import type { ParamDef, ParamValues, RawValues } from "./types";

/**
 * Splits params into stream pages that each fit in one frame (≤20 registers).
 * Multi-byte params are never split across pages.
 */
export function pageParams(params: readonly ParamDef[], limit = MAX_REGISTERS_PER_STREAM): ParamDef[][] {
  const pages: ParamDef[][] = [];
  let current: ParamDef[] = [];
  let used = 0;
  for (const p of params) {
    if (used + p.registers.length > limit) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(p);
    used += p.registers.length;
  }
  if (current.length) pages.push(current);
  return pages;
}

/** Decodes one stream frame. `params` must be in request order. */
export function decodeFrame(params: readonly ParamDef[], frame: Uint8Array): { values: ParamValues; raw: RawValues } {
  const values: ParamValues = {};
  const raw: RawValues = {};
  let offset = 0;
  for (const p of params) {
    const n = p.registers.length;
    if (offset + n > frame.length) break;
    const bytes = Array.from(frame.subarray(offset, offset + n));
    values[p.id] = p.decode(bytes);
    raw[p.id] = bytes;
    offset += n;
  }
  return { values, raw };
}
