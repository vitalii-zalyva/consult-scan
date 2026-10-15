// Spec: specs/004-live-dashboard/spec.md (LD-4xx)
import type { CompressionReason } from "@/analysis/compression";
import type { Condition } from "@/analysis/conditions";
import type { AbortReason, Interlock } from "@/analysis/power-balance";
import type { SessionState } from "@/protocol/session";
import type { InjectedFault, Scenario } from "@/simulator/engine-model";

export interface Messages {
  // header / connection
  subtitle: string;
  source: string;
  sourceSerial: string;
  sourceFtdi: string;
  sourceSimulator: string;
  connect: string;
  disconnect: string;
  noWebSerial: string;
  // public demo (DM-104, DM-105)
  demo: { title: string; about: string; simulated: string; start: string; cable: string };
  state: Record<SessionState, string>;
  condition: Record<Condition, string>;
  ecu: (partNumber: string) => string;
  outOfReference: (n: number) => string;
  allInReference: string;
  connectedVia: (device: string) => string;
  controlUnit: string;
  units: Record<"engine" | "at" | "climate" | "hicas", string>;
  // progress (LD-402)
  progress: {
    init: string;
    partNumber: string;
    detect: (unit: string, i: number, n: number) => string;
    lookingForUnit: (unit: string) => string;
    unitsFound: (units: string) => string;
    deepScan: (i: number, found: number) => string;
    deepScanCancelled: string;
    deepScanDone: (found: number) => string;
  };
  errors: {
    initFailed: string;
    unitInitFailed: (unitByte: string) => string;
    clearNotAllowed: string;
    calibrateTooShort: (min: number, have: string) => string;
    calibrateBadInput: string;
  };
  // intro
  intro: {
    title: string;
    step1: string;
    step2: string;
    step3a: string;
    step3b: string;
    step4a: string;
    step4b: string;
    noCable: string;
  };
  // live table
  groups: Record<
    "engine" | "air-fuel" | "ignition" | "sensors" | "switches" | "transmission" | "climate" | "undocumented",
    string
  >;
  colParameter: string;
  colValue: string;
  colExpected: string;
  colTrend: string;
  unverified: string;
  unverifiedTitle: string;
  /** RC-104, RC-301 */
  suspect: string;
  suspectTitle: string;
  rawTitle: string;
  reg: string;
  on: string;
  off: string;
  // bits
  bitsTitle: string;
  bitsNote: string;
  bit: (n: number) => string;
  // fault codes
  faultCodes: string;
  faultCodesOf: (unit: string) => string;
  read: string;
  clear: string;
  clearConfirm: string;
  notReadYet: string;
  noCodes: string;
  presentNow: string;
  lastSeen: (starts: number) => string;
  unitCode: (unit: string, code: number) => string;
  // coverage
  coverageTitle: string;
  coverageSummary: (values: number, registers: number, unit: string, probed: number, undocumented: number) => string;
  scanUnits: string;
  scanningUnits: string;
  scanUnitsTitle: string;
  deepScan: string;
  deepScanTitle: string;
  cancelDeepScan: string;
  // logging
  logging: string;
  recordCsv: string;
  stopRecording: (n: number) => string;
  saveTraffic: string;
  saveTrafficTitle: string;
  // simulator
  simulator: string;
  scenarios: Record<Scenario, string>;
  faults: Record<InjectedFault, string>;
  storeDtc: string;
  coldRestart: string;
  simWeakCylinder: string;
  simNone: string;
  simIgnoreRestore: string;
  simStallOnCut: string;
  // fuel
  fuel: {
    title: string;
    calculated: string;
    calculatedTitle: string;
    implausible: string;
    duration: (h: number, min: number) => string;
    resetTrip: string;
    calibrate: string;
    calibrateAvailableAfter: (l: number) => string;
    calibratePrompt: (litres: string) => string;
    settings: string;
    hideSettings: string;
    injector: string;
    deadTime: string;
    deadTimeSlope: string;
    calibration: string;
    settingsNote: string;
  };
  // diagnosis
  dx: {
    title: string;
    checksRun: (ran: number, total: number) => string;
    nothing: (ran: number) => string;
    collecting: string;
    waitingFor: (needs: string, labels: string) => string;
    whatToCheck: string;
    likely: string;
    possible: string;
    disclaimer: string;
  };
  // cylinder health (spec 012)
  cyl: {
    sectionTitle: string;
    pbTitle: string;
    pbIntro: string;
    start: string;
    stop: string;
    dryRun: string;
    dryRunHint: string;
    rounds: string;
    odometer: string;
    confirm: (dryRun: boolean) => string;
    interlock: Record<Interlock, string>;
    notInPN: string;
    phase: {
      baseline: (c: number, r: number) => string;
      cut: (c: number, r: number) => string;
      recover: (c: number, r: number) => string;
      restoring: string;
      done: string;
    };
    abort: Record<AbortReason, string>;
    restoreWarning: string;
    inconclusive: string;
    cylinder: (n: number) => string;
    dropRpm: string;
    dropPct: string;
    aacRise: string;
    status: Record<"ok" | "warn" | "bad", string>;
    resultHeader: (date: string, mode: string) => string;
    dryRunDone: string;
    weak: (cyls: string) => string;
    allOk: string;
    nextSteps: string;
    history: string;
    exportCsv: string;
    noResults: string;
    compTitle: string;
    compIntro: string;
    date: string;
    warm: string;
    wet: string;
    pressureUnit: string;
    cranking: string;
    notes: string;
    save: string;
    remove: string;
    invalid: string;
    specTitle: string;
    specStandard: string;
    specMinimum: string;
    specMaxDiff: string;
    specNote: string;
    spread: (v: string) => string;
    reason: Record<CompressionReason, string>;
    hint: { rings: (c: number) => string; valves: (c: number) => string; headGasket: (a: number, b: number) => string };
    dryLabel: string;
    wetLabel: string;
  };
  // units of measure
  unit: Record<string, string>;
}
