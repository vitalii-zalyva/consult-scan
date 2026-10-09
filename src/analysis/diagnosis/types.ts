// Spec: specs/011-diagnosis/spec.md. Thresholds are heuristics, not FSM values.
import type { CompressionEvaluation } from "@/analysis/compression";
import type { Sample } from "@/analysis/evaluate";
import type { FuelSettings } from "@/analysis/fuel";
import type { PowerBalanceResult } from "@/analysis/power-balance";
import type { FaultCodeReading } from "@/protocol/fault-codes";
import type { ParamValues } from "@/protocol/registers";

export type Severity = "bad" | "warn";
export type Confidence = "likely" | "possible";

export interface Problem {
  id: string;
  title: string;
  severity: Severity;
  confidence: Confidence;
  evidence: string[];
  checks: string[];
  codes?: number[];
}

export type RuleStatus = "ok" | "problem" | "waiting";

export interface Coverage {
  id: string;
  label: string;
  status: RuleStatus;
  /** What the rule still needs when waiting. */
  needs?: string;
}

export interface DiagnosisContext {
  samples: readonly Sample[];
  latest: ParamValues;
  codes: readonly FaultCodeReading[] | null;
  fuel?: FuelSettings;
  /** CY-601: latest stored cylinder-health results. */
  cylinders?: {
    powerBalance?: PowerBalanceResult;
    compression?: { date: string; evaluation: CompressionEvaluation };
  };
}

export interface Diagnosis {
  problems: Problem[];
  coverage: Coverage[];
}

export type RuleResult = Problem | Problem[] | null | "waiting";

export interface Rule {
  id: string;
  /** Key into DxText.needs. */
  needs: string;
  run: (ctx: DiagnosisContext, t: DxText) => RuleResult;
}
export interface DxText {
  /** Number formatting. */
  n: (x: number, digits?: number) => string;
  na: string;
  bank: (b: 1 | 2) => string;
  labels: Record<string, string>;
  needs: Record<string, string>;
  leak: {
    title: string;
    evidence: (alpha: string, learn: string) => string;
    hold2000: string;
    at2000: (alpha: string, improves: boolean) => string;
    checks: string[];
  };
  lean: {
    titleMaf: string;
    title: string;
    evidence: (idle: string, at2000: string) => string;
    noMaf: string;
    maf: (v: string) => string;
    checks: string[];
  };
  rich: {
    title: string;
    evidence: (alpha: string, learn: string) => string;
    mafHigh: (v: string) => string;
    checks: string[];
  };
  balance: {
    title: (bank: string) => string;
    evidence: (b1: string, b2: string) => string;
    checks: (bank: string) => string[];
  };
  o2slow: { title: (bank: string) => string; evidence: (cycles: number, at2000: boolean) => string; checks: string[] };
  o2lean: { title: (bank: string) => string; evidence: (v: string) => string; checks: string[] };
  o2rich: { title: (bank: string) => string; evidence: (v: string) => string; checks: string[] };
  cat: { title: string; evidence: (rear: number, front: number) => string; checks: string[] };
  thermostat: { title: string; evidence: (c: string, min: string, warm: number) => string; checks: string[] };
  overheat: { title: string; coolant: (c: string) => string; fanOff: string; checks: string[] };
  chargeLow: { title: string; evidence: (v: string) => string; checks: string[] };
  chargeHigh: { title: string; evidence: (v: string) => string; checks: string[] };
  battery: { title: string; evidence: (v: string) => string; checks: string[] };
  aacHigh: { title: string; evidence: (v: string) => string; checks: string[] };
  aacLow: { title: string; evidence: (v: string) => string; checks: string[] };
  idle: { title: string; evidence: (sd: string) => string; checks: string[] };
  timing: { title: string; evidence: (t: string) => string; load: string; checks: string[] };
  tps: { titleJump: string; title: string; evidence: (v: string) => string; jump: string; checks: string[] };
  idleSwitch: { title: string; evidence: string; checks: string[] };
  mafCircuit: { title: string; evidence: (v: string) => string; checks: string[] };
  ectCircuit: { title: string; evidence: (v: string) => string; checks: string[] };
  tpsCircuit: { title: string; evidence: (v: string) => string; checks: string[] };
  idleFuel: { title: string; evidence: (lh: string) => string; checks: string[] };
  code: {
    title: (code: number, name: string) => string;
    present: string;
    past: (n: number) => string;
    fallback: string;
  };
  cylinder: {
    title: (cyl: number) => string;
    powerBalance: (date: string, drop: string, pct: string) => string;
    compression: (date: string, kpa: string) => string;
    checksPowerBalance: string[];
    checksCompression: string[];
  };
}
