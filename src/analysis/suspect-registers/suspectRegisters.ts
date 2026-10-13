/**
 * Registers whose generic (PLMS) decoding contradicts real-car data on a given ECU.
 * Spec: specs/013-a32-register-corrections/spec.md (RC-101..107)
 * Suspect params are still streamed and shown raw, but get no reference ranges and feed no derived values.
 */
import type { ReferenceRule } from "@/analysis/reference-ranges";
import type { ParamId } from "@/protocol/registers";

import { SUSPECT_REGISTERS } from "./table";
import type { SuspectEntry } from "./types";

/** RC-102: "23710-44U01 (ROM 048A)" → "23710-44U01". */
export const ecuBase = (partNumber: string | undefined): string => (partNumber ?? "").split(" (")[0]!.trim();

/** RC-101, RC-107: suspect params for the connected ECU (empty for unknown/other ECUs). */
export function suspectParams(
  partNumber: string | undefined,
  list: readonly SuspectEntry[] = SUSPECT_REGISTERS,
): ReadonlyMap<ParamId, SuspectEntry> {
  const base = ecuBase(partNumber);
  return new Map(base ? list.filter((e) => e.ecu === base).map((e) => [e.param, e]) : []);
}

/** RC-105: reference rules minus the suspect params. */
export const rulesWithout = (
  rules: readonly ReferenceRule[],
  suspect: ReadonlyMap<ParamId, unknown>,
): readonly ReferenceRule[] => (suspect.size ? rules.filter((r) => !suspect.has(r.param)) : rules);
