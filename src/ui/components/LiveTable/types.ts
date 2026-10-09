import type { Condition } from "@/analysis/conditions";
import type { Evaluation, Sample } from "@/analysis/evaluate";
import type { ParamDef, ParamId, ParamValues, RawValues } from "@/protocol/registers";

export interface LiveTableProps {
  params: readonly ParamDef[];
  values: ParamValues;
  raw: RawValues;
  evaluations: Partial<Record<ParamId, Evaluation>>;
  condition: Condition;
  history: readonly Sample[];
}
