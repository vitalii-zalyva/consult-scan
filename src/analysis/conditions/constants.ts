// Spec: specs/005-reference-ranges/spec.md (RR-1xx)

/** FSM: "after warming up" means coolant above 70 °C. */
export const WARM_COOLANT_C = 70;

/** RR-102: closed-throttle TPS voltage (FSM 0.35–0.65 V) and idle rpm ceilings. */
export const CLOSED_TPS_V = 0.65;
export const IDLE_MAX_RPM = 1500;
export const IDLE_MAX_RPM_NO_TPS = 1200;
