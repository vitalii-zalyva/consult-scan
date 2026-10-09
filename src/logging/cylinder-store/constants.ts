// Spec: specs/012-cylinder-health/spec.md (CY-306, CY-504, CY-505)

export const KEYS = {
  powerBalance: "consult.cyl.powerBalance",
  compression: "consult.cyl.compression",
  spec: "consult.cyl.compressionSpec",
  fullRunDone: "consult.cyl.fullRunDone",
} as const;
export const MAX_HISTORY = 50;
