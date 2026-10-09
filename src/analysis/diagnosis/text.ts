/**
 * Texts for the diagnosis rules, kept apart from the rule logic.
 * Spec: specs/011-diagnosis/spec.md
 */
import type { DxText } from "./types";

const en: DxText = {
  n: (x, d = 1) => x.toFixed(d),
  na: "n/a",
  bank: (b) => `bank ${b}`,
  labels: {
    "DX-201": "Intake air leak",
    "DX-202": "MAF / fuel pressure (lean everywhere)",
    "DX-203": "Running rich",
    "DX-204": "Bank 1 vs bank 2 balance",
    "DX-205": "Front O2 sensor response",
    "DX-206": "Front O2 sensor stuck",
    "DX-207": "Catalyst efficiency",
    "DX-208": "Thermostat",
    "DX-209": "Overheating / cooling fan",
    "DX-210": "Charging system / battery",
    "DX-211": "Idle air control",
    "DX-212": "Idle stability",
    "DX-213": "Base ignition timing",
    "DX-214": "Throttle position sensor",
    "DX-215": "Closed-throttle (idle) switch",
    "DX-216": "Sensor circuits",
    "DX-217": "Idle fuel consumption",
    "DX-218": "Stored fault codes",
    "DX-219": "Cylinder health (power balance / compression)",
  },
  needs: {
    idle: "warm idle for 10 s",
    idleAnd2000: "warm idle and warm 2000 rpm, 10 s each",
    bothBanks: "warm idle or 2000 rpm for 10 s, both banks",
    o2: "warm 2000 rpm (or idle) for 10 s",
    at2000: "warm 2000 rpm for 10 s",
    cat: "warm 2000 rpm for 10 s, rear O2 sensor",
    running10: "engine running for 10 min",
    coolant: "coolant temperature",
    battery: "battery voltage for 5 s",
    running: "engine running",
    codes: "fault codes read",
    cylinderTests: "a power balance test or a compression entry",
  },
  leak: {
    title: "Possible intake air (vacuum) leak",
    evidence: (a, l) => `Warm idle A/F alpha ${a} % (normal ≈ 100 %), self-learn ${l}: the ECU is adding fuel.`,
    hold2000: "Hold 2000 rpm for 10 s: a leak typically gets smaller at higher airflow.",
    at2000: (a, imp) =>
      `At 2000 rpm alpha ${a} % — ${imp ? "lean condition improves with airflow, typical for a leak" : "lean also at 2000 rpm, see MAF / fuel pressure"}.`,
    checks: [
      "Listen for hissing around the intake plenum, throttle body and brake booster hose.",
      "Check PCV hose, intake boot after the MAF, and vacuum lines for cracks.",
      "Spray carb cleaner around joints at idle — rpm change marks the leak.",
    ],
  },
  lean: {
    titleMaf: "MAF sensor likely under-reading",
    title: "Lean at all speeds: MAF or low fuel pressure",
    evidence: (i, t) => `A/F alpha ${i} % at idle and ${t} % at 2000 rpm — lean regardless of airflow.`,
    noMaf: "MAF voltage not available.",
    maf: (v) => `Idle MAF ${v} V (reference 1.0–1.7 V).`,
    checks: [
      "Clean the MAF sensing element with MAF cleaner.",
      "Measure fuel pressure (FSM EC section); check fuel filter and pump.",
      "Check for an air leak between MAF and throttle body.",
    ],
  },
  rich: {
    title: "Mixture running rich",
    evidence: (a, l) => `Warm idle A/F alpha ${a} %, self-learn ${l}: the ECU is removing fuel.`,
    mafHigh: (v) => `Idle MAF ${v} V is above 1.7 V — MAF may over-read.`,
    checks: [
      "Check fuel pressure regulator (fuel in its vacuum hose = leaking diaphragm).",
      "Check for leaking injectors.",
      "Check the coolant temp reading is realistic (cold reading = extra fuel).",
    ],
  },
  balance: {
    title: (b) => `Mixture differs between banks (${b} leaner)`,
    evidence: (b1, b2) => `A/F alpha bank 1 ${b1} %, bank 2 ${b2} %.`,
    checks: (b) => [
      `Injectors and intake gasket on ${b}.`,
      `Front O2 sensor on ${b}; exhaust leak before that sensor.`,
    ],
  },
  o2slow: {
    title: (b) => `Front O2 sensor ${b} switching slowly`,
    evidence: (c, at2000) =>
      `${c} lean↔rich cycles in 10 s at ${at2000 ? "2000 rpm" : "idle"}; FSM expects more than 5 at 2000 rpm.`,
    checks: [
      "Aged or contaminated O2 sensor (oil/coolant consumption).",
      "Check the O2 heater circuit.",
      "Exhaust leak before the sensor.",
    ],
  },
  o2lean: {
    title: (b) => `Front O2 ${b} stays lean`,
    evidence: (v) => `Max ${v} V in 10 s at 2000 rpm — never crosses 0.45 V.`,
    checks: [
      "Exhaust leak before the sensor (sucks in air).",
      "Dead O2 sensor.",
      "Real lean condition — see air leak / fuel pressure.",
    ],
  },
  o2rich: {
    title: (b) => `Front O2 ${b} stays rich`,
    evidence: (v) => `Min ${v} V in 10 s at 2000 rpm — never drops below 0.45 V.`,
    checks: ["Leaking injector or high fuel pressure.", "Contaminated O2 sensor (silicone, coolant)."],
  },
  cat: {
    title: "Catalytic converter may be worn",
    evidence: (r, f) =>
      `Rear O2 switches ${r} times vs front ${f} in 10 s — a working catalyst keeps the rear signal steady.`,
    checks: ["Confirm with a longer 2000 rpm hold.", "Check for exhaust leaks near the rear sensor."],
  },
  thermostat: {
    title: "Thermostat may be stuck open",
    evidence: (c, m, w) => `Coolant only ${c} °C after ${m} min of running (warm ≥ ${w} °C).`,
    checks: [
      "Replace the thermostat; a cold engine runs rich and wears faster.",
      "Compare with the dash gauge to rule out the coolant sensor.",
    ],
  },
  overheat: {
    title: "Engine is overheating",
    coolant: (c) => `Coolant ${c} °C.`,
    fanOff: "Cooling fan outputs (0x1E bits 0–1) are both off — possible fan control fault (bit positions unverified).",
    checks: [
      "Stop the engine if it keeps rising.",
      "Check coolant level, radiator fans, thermostat and water pump.",
      "White smoke / coolant loss → head gasket.",
    ],
  },
  chargeLow: {
    title: "Alternator not charging enough",
    evidence: (v) => `Battery ${v} V with the engine running (expected 13.2–14.8 V).`,
    checks: ["Check the drive belt tension.", "Test the alternator output and battery terminals / ground straps."],
  },
  chargeHigh: {
    title: "Overcharging",
    evidence: (v) => `Battery ${v} V with the engine running (max ≈ 14.8 V).`,
    checks: ["Faulty alternator voltage regulator — can damage the battery and electronics."],
  },
  battery: {
    title: "Battery weak or discharged",
    evidence: (v) => `Battery ${v} V with the engine off (healthy ≈ 12.4–12.8 V).`,
    checks: ["Charge and load-test the battery.", "Check for parasitic drain."],
  },
  aacHigh: {
    title: "Idle air valve working hard (dirty throttle body?)",
    evidence: (v) => `IACV-AAC ${v} % at warm idle (reference 20–40 %).`,
    checks: [
      "Clean the throttle body and AAC valve passages.",
      "Check for extra engine load (alternator, A/C, power steering).",
    ],
  },
  aacLow: {
    title: "Idle air valve nearly closed (unmetered air?)",
    evidence: (v) => `IACV-AAC ${v} % at warm idle (reference 20–40 %).`,
    checks: ["Look for a vacuum leak.", "Check the throttle stop screw / FICD adjustment."],
  },
  idle: {
    title: "Unstable idle",
    evidence: (sd) => `Idle rpm varies ±${sd} rpm (std-dev) over 10 s.`,
    checks: ["Misfire: spark plugs, coils, plug wires.", "Vacuum leak.", "Sticking AAC valve or dirty throttle body."],
  },
  timing: {
    title: "Ignition timing at idle outside 15±2°",
    evidence: (t) => `Timing ${t}° BTDC at warm idle.`,
    load: "The ECU also moves timing with load (A/C, gear engaged).",
    checks: [
      "Check base timing per FSM (TPS disconnected / idle switch procedure).",
      "Check camshaft position sensor.",
    ],
  },
  tps: {
    titleJump: "Throttle position sensor signal jumps",
    title: "Throttle position sensor out of adjustment",
    evidence: (v) => `Closed-throttle TPS ${v} V (reference 0.35–0.65 V).`,
    jump: "Signal jumped by more than 1 V while rpm was steady — worn track.",
    checks: ["Adjust the TPS per FSM.", "Sweep the throttle slowly and watch for dropouts."],
  },
  idleSwitch: {
    title: "Idle switch not reporting closed throttle",
    evidence: "Throttle closed (TPS < 0.65 V) but 0x13 bit 0 (closed throttle) is off. Bit position unverified.",
    checks: ["Adjust the idle switch / TPS per FSM — affects idle speed control and timing."],
  },
  mafCircuit: {
    title: "MAF sensor circuit fault",
    evidence: (v) => `MAF ${v} V with the engine running.`,
    checks: ["MAF connector and wiring, MAF power/ground."],
  },
  ectCircuit: {
    title: "Coolant temperature sensor circuit fault",
    evidence: (v) => `Coolant reads ${v} °C — open/short circuit.`,
    checks: ["ECT sensor connector and wiring."],
  },
  tpsCircuit: {
    title: "Throttle position sensor circuit fault",
    evidence: (v) => `TPS ${v} V.`,
    checks: ["TPS connector and wiring."],
  },
  idleFuel: {
    title: "High fuel use at idle",
    evidence: (lh) => `Calculated ${lh} L/h at warm idle (typical ≈ 1 L/h). Depends on injector settings (spec 010).`,
    checks: ["Check rich-running causes and idle load.", "Verify the fuel calculator injector settings."],
  },
  code: {
    title: (c, name) => `Fault code ${c}: ${name}`,
    present: "Present now.",
    past: (n) => `Last seen ${n} engine start(s) ago (intermittent or already fixed).`,
    fallback: "Follow the FSM EC diagnostic procedure for this code.",
  },
  cylinder: {
    title: (c) => `Cylinder ${c} is weak`,
    powerBalance: (d, drop, pct) =>
      `Power balance ${d}: cutting it lowers rpm by only ${drop} rpm (${pct} %), much less than the other cylinders.`,
    compression: (d, kpa) => `Compression ${d}: ${kpa} kPa — below minimum or too far below the other cylinders.`,
    checksPowerBalance: [
      "Swap its ignition coil with a neighbouring cylinder and repeat the test — if the weak cylinder moves, it is the coil.",
      "Check the spark plug (wear, oil fouling).",
      "Check the injector (resistance, spray / leak test).",
      "If ignition and injector are fine, do a compression test.",
    ],
    checksCompression: [
      "Repeat as a wet test (a little oil in the cylinder): a rise points to rings, no change to valves.",
      "Leak-down test to locate the leak (intake, exhaust, crankcase, cooling system).",
      "Two neighbouring low cylinders on the same bank → head gasket between them.",
    ],
  },
};

export const DX_TEXT: DxText = en;
