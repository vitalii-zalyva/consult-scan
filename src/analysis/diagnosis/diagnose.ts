/**
 * Rule-based "possible problems" from live data, history and fault codes.
 * Spec: specs/011-diagnosis/spec.md. Thresholds are heuristics, not FSM values.
 * Texts: diagnosisText.ts.
 */
import { RULES } from "./rules";
import { DX_TEXT } from "./text";
import type { Coverage, Diagnosis, DiagnosisContext, Problem } from "./types";

const rank = (p: Problem) => (p.severity === "bad" ? 0 : 2) + (p.confidence === "likely" ? 0 : 1);

/** DX-101..105 */
export function diagnose(ctx: DiagnosisContext): Diagnosis {
  const t = DX_TEXT;
  const problems: Problem[] = [];
  const coverage: Coverage[] = [];
  for (const rule of RULES) {
    const label = t.labels[rule.id] ?? rule.id;
    const r = rule.run(ctx, t);
    if (r === "waiting") {
      coverage.push({ id: rule.id, label, status: "waiting", needs: t.needs[rule.needs] ?? rule.needs });
    } else if (r === null) {
      coverage.push({ id: rule.id, label, status: "ok" });
    } else {
      problems.push(...(Array.isArray(r) ? r : [r]));
      coverage.push({ id: rule.id, label, status: "problem" });
    }
  }
  problems.sort((a, b) => rank(a) - rank(b));
  return { problems, coverage };
}
