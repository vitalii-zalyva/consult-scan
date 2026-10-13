// Spec: specs/005-reference-ranges/spec.md (RR-3xx, RR-4xx)

/** Outside the range by up to this fraction of its width = "warn" instead of "bad" (RR-302). */
export const WARN_MARGIN = 0.1;

/** RR-304: statuses are judged on the mean of the last few seconds, so noise at a limit does not flicker. */
export const STATUS_WINDOW_MS = 3_000;

/** RR-305: a new status must persist this long before it is shown. */
export const STATUS_HOLD_MS = 2_000;

export const O2_WINDOW_MS = 10_000;
