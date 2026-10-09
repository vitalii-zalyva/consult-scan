// Spec: specs/006-fault-codes/spec.md

export interface FaultCodeInfo {
  code: number;
  name: string;
  /** What to check first. Kept short; the FSM EC section has full procedures. */
  hint?: string;
}

export interface FaultCodeReading extends FaultCodeInfo {
  /** Engine starts since the fault was last seen (0 = present now). */
  startsSinceObserved: number;
}
