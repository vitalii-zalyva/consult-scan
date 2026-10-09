import type { InjectedFault, Scenario } from "@/simulator/engine-model";

export const SCENARIOS: Scenario[] = ["off", "idle", "rev2000", "drive"];
export const FAULTS: InjectedFault[] = ["o2-lazy", "vacuum-leak", "maf-high", "overheat", "weak-alternator"];
