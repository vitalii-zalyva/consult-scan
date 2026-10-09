// Spec: specs/011-diagnosis/spec.md. Thresholds are heuristics, not FSM values.

export const STEADY_MIN_MS = 8_000;
export const STEADY_WINDOW_MS = 10_000;
export const LOOKBACK_MS = 120_000;

export const BANKS = [
  ["o2Lh", 1],
  ["o2Rh", 2],
] as const;
