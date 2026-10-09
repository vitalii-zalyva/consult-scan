// Spec: specs/011-diagnosis/spec.md. Thresholds are heuristics, not FSM values.
import { WARM_COOLANT_C } from "@/analysis/conditions";
import { o2SwitchCount } from "@/analysis/evaluate";
import { DEFAULT_FUEL_SETTINGS, fuelRate } from "@/analysis/fuel";

import { BANKS } from "./constants";
import { avg, avgBanks, lastSteady, mean, nums, stdev } from "./helpers";
import type { Problem, Rule } from "./types";

export const RULES: Rule[] = [
  {
    id: "DX-201",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const alpha = avgBanks(idle, "afAlphaLh", "afAlphaRh");
      const learn = avgBanks(idle, "afLearnLh", "afLearnRh");
      if (alpha === undefined) return "waiting";
      if (!(alpha > 115 || (learn ?? 100) > 112)) return null;
      const at2000 = lastSteady(samples, "warm-2000");
      const alpha2000 = at2000 ? avgBanks(at2000, "afAlphaLh", "afAlphaRh") : undefined;
      const improves = alpha2000 !== undefined && alpha - alpha2000 >= 8;
      return {
        id: "DX-201",
        title: t.leak.title,
        severity: alpha > 125 ? "bad" : "warn",
        confidence: improves ? "likely" : "possible",
        evidence: [
          t.leak.evidence(t.n(alpha, 0), learn === undefined ? t.na : `${t.n(learn, 0)} %`),
          alpha2000 === undefined ? t.leak.hold2000 : t.leak.at2000(t.n(alpha2000, 0), improves),
        ],
        checks: t.leak.checks,
      };
    },
  },
  {
    id: "DX-202",
    needs: "idleAnd2000",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      const at2000 = lastSteady(samples, "warm-2000");
      if (!idle || !at2000) return "waiting";
      const a1 = avgBanks(idle, "afAlphaLh", "afAlphaRh");
      const a2 = avgBanks(at2000, "afAlphaLh", "afAlphaRh");
      if (a1 === undefined || a2 === undefined || !(a1 > 115 && a2 > 115)) return null;
      const maf = avg(idle, "mafLh");
      const mafLow = maf !== undefined && maf < 1.0;
      return {
        id: "DX-202",
        title: mafLow ? t.lean.titleMaf : t.lean.title,
        severity: "warn",
        confidence: mafLow ? "likely" : "possible",
        evidence: [t.lean.evidence(t.n(a1, 0), t.n(a2, 0)), maf === undefined ? t.lean.noMaf : t.lean.maf(t.n(maf, 2))],
        checks: t.lean.checks,
      };
    },
  },
  {
    id: "DX-203",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const alpha = avgBanks(idle, "afAlphaLh", "afAlphaRh");
      const learn = avgBanks(idle, "afLearnLh", "afLearnRh");
      if (alpha === undefined) return "waiting";
      if (!(alpha < 85 || (learn ?? 100) < 88)) return null;
      const maf = avg(idle, "mafLh");
      return {
        id: "DX-203",
        title: t.rich.title,
        severity: alpha < 75 ? "bad" : "warn",
        confidence: "possible",
        evidence: [
          t.rich.evidence(t.n(alpha, 0), learn === undefined ? t.na : `${t.n(learn, 0)} %`),
          ...(maf !== undefined && maf > 1.7 ? [t.rich.mafHigh(t.n(maf, 2))] : []),
        ],
        checks: t.rich.checks,
      };
    },
  },
  {
    id: "DX-204",
    needs: "bothBanks",
    run: ({ samples }, t) => {
      const w = lastSteady(samples, "warm-2000") ?? lastSteady(samples, "warm-idle");
      if (!w) return "waiting";
      const b1 = avg(w, "afAlphaLh");
      const b2 = avg(w, "afAlphaRh");
      if (b1 === undefined || b2 === undefined) return "waiting";
      if (Math.abs(b1 - b2) <= 15) return null;
      const lean = t.bank(b1 > b2 ? 1 : 2);
      return {
        id: "DX-204",
        title: t.balance.title(lean),
        severity: "warn",
        confidence: "possible",
        evidence: [t.balance.evidence(t.n(b1, 0), t.n(b2, 0))],
        checks: t.balance.checks(lean),
      };
    },
  },
  {
    id: "DX-205",
    needs: "o2",
    run: ({ samples }, t) => {
      const at2000 = lastSteady(samples, "warm-2000");
      const w = at2000 ?? lastSteady(samples, "warm-idle");
      if (!w) return "waiting";
      const out: Problem[] = [];
      for (const [p, bank] of BANKS) {
        if (!nums(w, p).length) continue;
        const cycles = Math.floor(o2SwitchCount(w, p) / 2);
        if (cycles > 5) continue;
        out.push({
          id: `DX-205-${p}`,
          title: t.o2slow.title(t.bank(bank)),
          severity: at2000 ? "bad" : "warn",
          confidence: at2000 ? "likely" : "possible",
          evidence: [t.o2slow.evidence(cycles, !!at2000)],
          checks: t.o2slow.checks,
        });
      }
      return out.length ? out : null;
    },
  },
  {
    id: "DX-206",
    needs: "at2000",
    run: ({ samples }, t) => {
      const w = lastSteady(samples, "warm-2000");
      if (!w) return "waiting";
      const out: Problem[] = [];
      for (const [p, bank] of BANKS) {
        const xs = nums(w, p);
        if (!xs.length) continue;
        const max = Math.max(...xs);
        const min = Math.min(...xs);
        if (max < 0.45)
          out.push({
            id: `DX-206-${p}-lean`,
            title: t.o2lean.title(t.bank(bank)),
            severity: "bad",
            confidence: "likely",
            evidence: [t.o2lean.evidence(t.n(max, 2))],
            checks: t.o2lean.checks,
          });
        else if (min > 0.45)
          out.push({
            id: `DX-206-${p}-rich`,
            title: t.o2rich.title(t.bank(bank)),
            severity: "bad",
            confidence: "likely",
            evidence: [t.o2rich.evidence(t.n(min, 2))],
            checks: t.o2rich.checks,
          });
      }
      return out.length ? out : null;
    },
  },
  {
    id: "DX-207",
    needs: "cat",
    run: ({ samples }, t) => {
      const w = lastSteady(samples, "warm-2000");
      if (!w) return "waiting";
      if (!nums(w, "rearO2B1").length || !nums(w, "o2Lh").length) return "waiting";
      const front = o2SwitchCount(w, "o2Lh");
      const rear = o2SwitchCount(w, "rearO2B1");
      if (front < 6 || rear < front * 0.7) return null;
      return {
        id: "DX-207",
        title: t.cat.title,
        severity: "warn",
        confidence: "possible",
        evidence: [t.cat.evidence(rear, front)],
        checks: t.cat.checks,
      };
    },
  },
  {
    id: "DX-208",
    needs: "running10",
    run: ({ samples }, t) => {
      const latest = samples.at(-1);
      if (!latest || (latest.values.rpm ?? 0) < 400) return "waiting";
      let i = samples.length - 1;
      while (i > 0 && (samples[i - 1]!.values.rpm ?? 0) >= 400 && latest.t - samples[i - 1]!.t <= 30 * 60_000) i--;
      const runningMs = latest.t - samples[i]!.t;
      const coolant = latest.values.coolant;
      if (coolant === undefined) return "waiting";
      if (coolant >= WARM_COOLANT_C) return null;
      if (runningMs < 10 * 60_000) return "waiting";
      return {
        id: "DX-208",
        title: t.thermostat.title,
        severity: "warn",
        confidence: "likely",
        evidence: [t.thermostat.evidence(t.n(coolant, 0), t.n(runningMs / 60_000, 0), WARM_COOLANT_C)],
        checks: t.thermostat.checks,
      };
    },
  },
  {
    id: "DX-209",
    needs: "coolant",
    run: ({ latest }, t) => {
      const c = latest.coolant;
      if (c === undefined) return "waiting";
      if (c <= 100) return null;
      const bits = latest.bits1e;
      const fanOff = bits !== undefined && (bits & 0b11) === 0;
      return {
        id: "DX-209",
        title: t.overheat.title,
        severity: c > 105 ? "bad" : "warn",
        confidence: "likely",
        evidence: [t.overheat.coolant(t.n(c, 0)), ...(fanOff ? [t.overheat.fanOff] : [])],
        checks: t.overheat.checks,
      };
    },
  },
  {
    id: "DX-210",
    needs: "battery",
    run: ({ samples }, t) => {
      const latest = samples.at(-1);
      if (!latest) return "waiting";
      const recent = samples.filter((s) => s.t >= latest.t - 5_000);
      if (latest.t - (recent[0]?.t ?? latest.t) < 4_000) return "waiting";
      const running = recent.every((s) => (s.values.rpm ?? 0) > 400);
      const off = recent.every((s) => (s.values.rpm ?? 0) < 50);
      const v = avg(recent, "battery");
      if (v === undefined || (!running && !off)) return "waiting";
      const volts = t.n(v, 2);
      if (running && v < 13.2)
        return {
          id: "DX-210-low",
          title: t.chargeLow.title,
          severity: v < 13.0 ? "bad" : "warn",
          confidence: "likely",
          evidence: [t.chargeLow.evidence(volts)],
          checks: t.chargeLow.checks,
        };
      if (running && v > 15.0)
        return {
          id: "DX-210-high",
          title: t.chargeHigh.title,
          severity: "bad",
          confidence: "likely",
          evidence: [t.chargeHigh.evidence(volts)],
          checks: t.chargeHigh.checks,
        };
      if (off && v < 12.2)
        return {
          id: "DX-210-weak",
          title: t.battery.title,
          severity: "warn",
          confidence: "possible",
          evidence: [t.battery.evidence(volts)],
          checks: t.battery.checks,
        };
      return null;
    },
  },
  {
    id: "DX-211",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const aac = avg(idle, "aac");
      if (aac === undefined) return "waiting";
      const acOn = idle.some((s) => ((s.values.bits13 ?? 0) & 0b1_0000) !== 0);
      if (acOn) return "waiting";
      if (aac > 45)
        return {
          id: "DX-211-high",
          title: t.aacHigh.title,
          severity: "warn",
          confidence: "possible",
          evidence: [t.aacHigh.evidence(t.n(aac, 0))],
          checks: t.aacHigh.checks,
        };
      if (aac < 15)
        return {
          id: "DX-211-low",
          title: t.aacLow.title,
          severity: "warn",
          confidence: "possible",
          evidence: [t.aacLow.evidence(t.n(aac, 0))],
          checks: t.aacLow.checks,
        };
      return null;
    },
  },
  {
    id: "DX-212",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const sd = stdev(nums(idle, "rpm"));
      if (sd === undefined) return "waiting";
      if (sd <= 40) return null;
      return {
        id: "DX-212",
        title: t.idle.title,
        severity: sd > 80 ? "bad" : "warn",
        confidence: "possible",
        evidence: [t.idle.evidence(t.n(sd, 0))],
        checks: t.idle.checks,
      };
    },
  },
  {
    id: "DX-213",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const tm = avg(idle, "timing");
      if (tm === undefined) return "waiting";
      if (tm >= 13 && tm <= 17) return null;
      return {
        id: "DX-213",
        title: t.timing.title,
        severity: "warn",
        confidence: "possible",
        evidence: [t.timing.evidence(t.n(tm, 0)), t.timing.load],
        checks: t.timing.checks,
      };
    },
  },
  {
    id: "DX-214",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const tps = nums(idle, "tps");
      const m = mean(tps);
      if (m === undefined) return "waiting";
      const rpm = nums(idle, "rpm");
      const jump = tps
        .slice(1)
        .some((v, i) => Math.abs(v - tps[i]!) > 1 && Math.abs((rpm[i + 1] ?? 0) - (rpm[i] ?? 0)) < 100);
      if (m >= 0.35 && m <= 0.65 && !jump) return null;
      return {
        id: "DX-214",
        title: jump ? t.tps.titleJump : t.tps.title,
        severity: "warn",
        confidence: "possible",
        evidence: [t.tps.evidence(t.n(m, 2)), ...(jump ? [t.tps.jump] : [])],
        checks: t.tps.checks,
      };
    },
  },
  {
    id: "DX-215",
    needs: "idle",
    run: ({ samples }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      if (!idle.some((s) => s.values.bits13 !== undefined)) return "waiting";
      const closed = (mean(nums(idle, "tps")) ?? 1) < 0.65;
      const switchOn = idle.some((s) => ((s.values.bits13 ?? 0) & 1) === 1);
      if (!closed || switchOn) return null;
      return {
        id: "DX-215",
        title: t.idleSwitch.title,
        severity: "warn",
        confidence: "possible",
        evidence: [t.idleSwitch.evidence],
        checks: t.idleSwitch.checks,
        codes: [23],
      };
    },
  },
  {
    id: "DX-216",
    needs: "running",
    run: ({ latest }, t) => {
      if ((latest.rpm ?? 0) < 400) return "waiting";
      const out: Problem[] = [];
      const maf = latest.mafLh;
      if (maf !== undefined && (maf < 0.3 || maf > 4.9))
        out.push({
          id: "DX-216-maf",
          title: t.mafCircuit.title,
          severity: "bad",
          confidence: "likely",
          evidence: [t.mafCircuit.evidence(t.n(maf, 2))],
          checks: t.mafCircuit.checks,
          codes: [12],
        });
      const c = latest.coolant;
      if (c !== undefined && (c < -30 || c > 140))
        out.push({
          id: "DX-216-ect",
          title: t.ectCircuit.title,
          severity: "bad",
          confidence: "likely",
          evidence: [t.ectCircuit.evidence(t.n(c, 0))],
          checks: t.ectCircuit.checks,
          codes: [13],
        });
      const tps = latest.tps;
      if (tps !== undefined && (tps < 0.1 || tps > 4.9))
        out.push({
          id: "DX-216-tps",
          title: t.tpsCircuit.title,
          severity: "bad",
          confidence: "likely",
          evidence: [t.tpsCircuit.evidence(t.n(tps, 2))],
          checks: t.tpsCircuit.checks,
          codes: [43],
        });
      return out.length ? out : null;
    },
  },
  {
    id: "DX-217",
    needs: "idle",
    run: ({ samples, fuel }, t) => {
      const idle = lastSteady(samples, "warm-idle");
      if (!idle) return "waiting";
      const lh = mean(idle.map((s) => fuelRate(s.values, fuel ?? DEFAULT_FUEL_SETTINGS).litresPerHour));
      if (lh === undefined || lh <= 2.5) return null;
      return {
        id: "DX-217",
        title: t.idleFuel.title,
        severity: "warn",
        confidence: "possible",
        evidence: [t.idleFuel.evidence(t.n(lh, 2))],
        checks: t.idleFuel.checks,
      };
    },
  },
  {
    id: "DX-218",
    needs: "codes",
    run: ({ codes }, t) => {
      if (codes === null) return "waiting";
      if (!codes.length) return null;
      return codes.map((c) => ({
        id: `DX-218-${c.code}`,
        title: t.code.title(c.code, c.name),
        severity: c.startsSinceObserved === 0 ? ("bad" as const) : ("warn" as const),
        confidence: c.startsSinceObserved === 0 ? ("likely" as const) : ("possible" as const),
        evidence: [c.startsSinceObserved === 0 ? t.code.present : t.code.past(c.startsSinceObserved)],
        checks: [c.hint ?? t.code.fallback],
        codes: [c.code],
      }));
    },
  },
];

export const RULE_COUNT = RULES.length;
