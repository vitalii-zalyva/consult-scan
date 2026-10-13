import type { Condition } from "@/analysis/conditions";
import type { Evaluation, Sample } from "@/analysis/evaluate";
import type { ReferenceRule } from "@/analysis/reference-ranges";
import type { SuspectEntry } from "@/analysis/suspect-registers";
import type { ParamDef, ParamId, ParamValues, RawValues } from "@/protocol/registers";

export interface LiveTableProps {
  params: readonly ParamDef[];
  values: ParamValues;
  raw: RawValues;
  evaluations: Partial<Record<ParamId, Evaluation>>;
  condition: Condition;
  history: readonly Sample[];
  /** RC-105: reference rules for this ECU (suspect params removed). */
  rules?: readonly ReferenceRule[];
  /** RC-104 */
  suspect?: ReadonlyMap<ParamId, SuspectEntry>;
}
