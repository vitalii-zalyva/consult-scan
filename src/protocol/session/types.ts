// Spec: 004-live-dashboard (LD-1xx), 001 (CP-5xx), 008 (XD-3xx), 009 (CU-1xx)
import type { Sample } from "@/analysis/evaluate";
import type { ParamDef } from "@/protocol/registers";
import type { UnitId } from "@/protocol/units";

export type SessionState = "disconnected" | "connecting" | "idle" | "streaming" | "busy" | "error";

/** LD-402: structured progress; the UI renders the text. */
export type Progress =
  | { kind: "init" }
  | { kind: "part-number" }
  | { kind: "detect"; unit: UnitId; i: number; n: number }
  | { kind: "looking-for-unit"; unit: UnitId }
  | { kind: "units-found"; units: UnitId[] }
  | { kind: "deep-scan"; i: number; found: number }
  | { kind: "deep-scan-cancelled" }
  | { kind: "deep-scan-done"; found: number };

export interface SessionEvents {
  onState?: (state: SessionState, message?: string) => void;
  onSample?: (sample: Sample) => void;
  onProgress?: (p: Progress) => void;
}

export interface UnitDetection {
  params: ParamDef[];
  undocumented: ParamDef[];
}
