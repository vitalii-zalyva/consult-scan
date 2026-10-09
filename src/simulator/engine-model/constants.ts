// Spec: specs/003-ecu-simulator/spec.md (SIM-2xx)

/** CY-701: rpm lost by the cut cylinder; idle control wins back up to half of it over ~3 s. */
export const CYLINDER_DROP_RPM = 80;
export const WEAK_CYLINDER_DROP_RPM = 20;
