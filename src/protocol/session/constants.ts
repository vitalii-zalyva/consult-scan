// Spec: 004-live-dashboard (LD-1xx), 001 (CP-5xx), 008 (XD-3xx), 009 (CU-1xx)

/** History kept in memory for charts and checks (≈ 10 min at 25 Hz). */
export const HISTORY_LIMIT = 15_000;
