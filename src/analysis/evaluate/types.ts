// Spec: specs/005-reference-ranges/spec.md (RR-3xx, RR-4xx)
import type { ReferenceRule } from "@/analysis/reference-ranges";
import type { ParamValues } from "@/protocol/registers";

export type Status = "ok" | "warn" | "bad" | "na";

export interface Evaluation {
  status: Status;
  /** Rules that applied in the current condition (the UI renders their ranges and notes). */
  applied: readonly ReferenceRule[];
  /** Applied rules the value violates. */
  failing: readonly ReferenceRule[];
}

export interface Sample {
  t: number; // ms
  values: ParamValues;
}

export interface Finding {
  id: string;
  status: Exclude<Status, "ok" | "na">;
  title: string;
  detail: string;
}
