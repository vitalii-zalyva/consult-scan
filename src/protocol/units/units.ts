/**
 * Consult-I control units. The third init byte selects the unit.
 * Spec: specs/009-other-control-units/spec.md
 * Source: PLMS "Generic Nissan ECU register table v2" (A/T, HICAS, A/C sections).
 */
import { PARAMS } from "@/protocol/registers";

import { CLIMATE_PARAMS } from "./climate";
import { AT_PARAMS } from "./transmission";
import type { ControlUnit, UnitId } from "./types";

export const UNITS: Readonly<Record<UnitId, ControlUnit>> = {
  engine: { id: "engine", label: "Engine", initByte: 0xef, params: PARAMS, canClearCodes: true },
  at: { id: "at", label: "Transmission", initByte: 0xea, params: AT_PARAMS, canClearCodes: false },
  climate: { id: "climate", label: "Climate", initByte: 0xdf, params: CLIMATE_PARAMS, canClearCodes: false },
  hicas: { id: "hicas", label: "HICAS", initByte: 0xe4, params: [], canClearCodes: false },
};

export const UNIT_LIST: readonly ControlUnit[] = Object.values(UNITS);
