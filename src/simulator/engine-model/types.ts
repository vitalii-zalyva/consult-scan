// Spec: specs/003-ecu-simulator/spec.md (SIM-2xx)

export type Scenario = "off" | "idle" | "rev2000" | "drive";
export type InjectedFault = "o2-lazy" | "vacuum-leak" | "maf-high" | "overheat" | "weak-alternator";

export interface EngineState {
  t: number;
  scenario: Scenario;
  faults: Set<InjectedFault>;
  rpm: number;
  coolant: number;
  speed: number;
  learn: number;
}
