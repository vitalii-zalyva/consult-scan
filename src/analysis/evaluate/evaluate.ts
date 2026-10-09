/**
 * Evaluates live values against reference rules and history-based checks.
 * Spec: specs/005-reference-ranges/spec.md (RR-3xx, RR-4xx)
 */
import type { Condition } from "@/analysis/conditions";
import type { ReferenceRule } from "@/analysis/reference-ranges";
import type { ParamId, ParamValues } from "@/protocol/registers";

import { WARN_MARGIN } from "./constants";
import type { Evaluation, Status } from "./types";

export function evaluateValue(value: number, rules: readonly ReferenceRule[]): Evaluation {
  if (rules.length === 0) return { status: "na", applied: [], failing: [] };
  let worst: Status = "ok";
  const failing: ReferenceRule[] = [];
  for (const rule of rules) {
    const { min, max } = rule.range;
    const margin = (max - min) * WARN_MARGIN;
    let status: Status = "ok";
    if (value < min - margin || value > max + margin) status = "bad";
    else if (value < min || value > max) status = "warn";
    if (status !== "ok") failing.push(rule);
    if (rank(status) > rank(worst)) worst = status;
  }
  return { status: worst, applied: rules, failing };
}

export function rulesFor(param: ParamId, condition: Condition, rules: readonly ReferenceRule[]): ReferenceRule[] {
  return rules.filter((r) => r.param === param && (r.when.length === 0 || r.when.includes(condition)));
}

export function evaluateAll(
  values: ParamValues,
  condition: Condition,
  rules: readonly ReferenceRule[],
): Partial<Record<ParamId, Evaluation>> {
  const out: Partial<Record<ParamId, Evaluation>> = {};
  for (const [id, value] of Object.entries(values) as [ParamId, number][]) {
    out[id] = evaluateValue(value, rulesFor(id, condition, rules));
  }
  return out;
}

const rank = (s: Status) => ({ na: 0, ok: 1, warn: 2, bad: 3 })[s];
