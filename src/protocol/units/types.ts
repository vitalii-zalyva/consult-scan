// Spec: specs/009-other-control-units/spec.md
import type { ParamDef } from "@/protocol/registers";

export type UnitId = "engine" | "at" | "climate" | "hicas";

export interface ControlUnit {
  id: UnitId;
  label: string;
  initByte: number;
  params: readonly ParamDef[];
  /** CU-104: only the engine supports clearing codes in this app. */
  canClearCodes: boolean;
}
