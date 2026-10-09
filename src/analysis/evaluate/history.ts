// Spec: specs/005-reference-ranges/spec.md (RR-3xx, RR-4xx)
import type { Condition } from "@/analysis/conditions";
import { WARM_COOLANT_C } from "@/analysis/conditions";
import type { ParamId } from "@/protocol/registers";

import { O2_WINDOW_MS } from "./constants";
import type { Finding, Sample } from "./types";

/**
 * RR-401: front O2 sensor must switch lean<->rich more than 5 times in 10 s
 * at warm ~2000 rpm (FSM "FR O2 MNTR"). We also apply it at warm idle as a warning.
 */
export function o2SwitchCount(samples: readonly Sample[], param: ParamId, threshold = 0.45): number {
  let last: boolean | null = null;
  let switches = 0;
  for (const s of samples) {
    const v = s.values[param];
    if (v === undefined) continue;
    const rich = v > threshold;
    if (last !== null && rich !== last) switches++;
    last = rich;
  }
  return switches;
}

export function historyFindings(samples: readonly Sample[], condition: Condition): Finding[] {
  const findings: Finding[] = [];
  const latest = samples.at(-1);
  if (!latest) return findings;
  const window = samples.filter((s) => s.t >= latest.t - O2_WINDOW_MS);
  const spanMs = (window.at(-1)?.t ?? 0) - (window[0]?.t ?? 0);
  const steady = window.every(
    (s) => (s.values.coolant ?? 0) >= WARM_COOLANT_C && (s.values.rpm ?? 0) > 400 && (s.values.speed ?? 0) <= 3,
  );

  if (steady && spanMs >= O2_WINDOW_MS * 0.9 && (condition === "warm-idle" || condition === "warm-2000")) {
    for (const param of ["o2Lh", "o2Rh"] as const) {
      if (!window.some((s) => s.values[param] !== undefined)) continue;
      const n = Math.floor(o2SwitchCount(window, param) / 2);
      if (n <= 5) {
        findings.push({
          id: `o2-switch-${param}`,
          status: condition === "warm-2000" ? "bad" : "warn",
          title: `Front O2 ${param === "o2Lh" ? "bank 1" : "bank 2"} is switching slowly`,
          detail: `${n} lean↔rich cycles in 10 s; FSM expects more than 5 at 2000 rpm. Possible aged O2 sensor or air/fuel problem.`,
        });
      }
    }
  }

  const alpha = latest.values.afAlphaLh;
  const learn = latest.values.afLearnLh;
  if (alpha !== undefined && learn !== undefined && (condition === "warm-idle" || condition === "warm-2000")) {
    if (alpha > 115 && learn > 110) {
      findings.push({
        id: "lean-trend",
        status: "warn",
        title: "Mixture running lean",
        detail: `A/F alpha ${alpha.toFixed(0)} % and self-learn ${learn.toFixed(0)} %: ECU adds fuel. Check for vacuum leaks, MAF contamination, low fuel pressure.`,
      });
    } else if (alpha < 85 && learn < 90) {
      findings.push({
        id: "rich-trend",
        status: "warn",
        title: "Mixture running rich",
        detail: `A/F alpha ${alpha.toFixed(0)} % and self-learn ${learn.toFixed(0)} %: ECU removes fuel. Check leaking injectors, fuel pressure regulator, coolant sensor.`,
      });
    }
  }
  return findings;
}
