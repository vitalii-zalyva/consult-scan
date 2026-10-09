import type { Sample } from "@/analysis/evaluate";
import type { ParamId } from "@/protocol/registers";

export interface SparklineProps {
  samples: readonly Sample[];
  param: ParamId;
  range?: { min: number; max: number };
  width?: number;
  height?: number;
}
