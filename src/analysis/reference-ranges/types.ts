// Spec: specs/005-reference-ranges/spec.md (RR-2xx)
import type { Condition } from "@/analysis/conditions";
import type { ParamId } from "@/protocol/registers";

export interface Range {
  min: number;
  max: number;
}

export interface ReferenceRule {
  param: ParamId;
  /** Conditions where this range applies. Empty = always. */
  when: readonly Condition[];
  range: Range;
  /** Text shown next to the value, e.g. FSM wording. */
  note: string;
  verified: boolean;
}
