// Spec: specs/001-consult-protocol/spec.md (CP-4xx), specs/008-extended-data/spec.md (XD-1xx, XD-2xx)

export type ParamId = string;

export type ParamGroup =
  "engine" | "air-fuel" | "sensors" | "ignition" | "switches" | "transmission" | "climate" | "undocumented";

export type ParamKind = "value" | "bits" | "onoff" | "enum";

export interface ParamDef {
  id: ParamId;
  label: string;
  /** Nissan service-manual (FSM) monitor item name, for cross-reference. */
  fsmName: string;
  unit: string;
  group: ParamGroup;
  /** Register addresses, MSB first for 16-bit values. */
  registers: readonly number[];
  /** Must be linear in the raw value (the simulator inverts it). */
  decode: (bytes: readonly number[]) => number;
  digits: number;
  kind?: ParamKind;
  /** kind "bits": label per bit number (index 0 = LSB); null = unknown. */
  bitLabels?: readonly (string | null)[];
  /** kind "enum": raw value -> label. */
  enumLabels?: Readonly<Record<number, string>>;
  verified: boolean;
}

export type ParamValues = Partial<Record<ParamId, number>>;
export type RawValues = Partial<Record<ParamId, readonly number[]>>;

export type Def = Omit<ParamDef, "verified" | "digits"> & { verified?: boolean; digits?: number };
