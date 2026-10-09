// Spec: specs/012-cylinder-health/spec.md (CY-5xx)

export type PressureUnit = "kPa" | "bar" | "psi" | "kgf/cm2";

export interface CompressionSpec {
  standardKpa: number;
  minimumKpa: number;
  maxDiffKpa: number;
}

export interface CompressionEntry {
  id: string;
  date: string;
  odometerKm?: number;
  warm: boolean;
  /** Wet test: a little oil added to the cylinder. */
  wet: boolean;
  /** Cylinders 1–6; null = not measured. */
  readingsKpa: (number | null)[];
  crankingRpm?: number;
  notes?: string;
}

export type CompressionReason = "below-minimum" | "below-standard" | "spread";
export interface CylinderCompression {
  cylinder: number;
  kpa: number | null;
  status: "ok" | "warn" | "bad" | "na";
  reasons: CompressionReason[];
}

export interface CompressionEvaluation {
  cylinders: CylinderCompression[];
  spreadKpa: number;
}

export type CompressionHint =
  | { kind: "rings"; cylinder: number }
  | { kind: "valves"; cylinder: number }
  | { kind: "head-gasket"; cylinders: [number, number] };
