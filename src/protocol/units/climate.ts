// Spec: specs/009-other-control-units/spec.md
import type { ParamDef } from "@/protocol/registers";
import { u8 } from "@/protocol/registers";

export const cl = (id: string, label: string, fsmName: string, reg: number, unit = "°C"): ParamDef => ({
  id: `climate.${id}`,
  label,
  fsmName,
  unit,
  group: "climate",
  registers: [reg],
  // PLMS says "WORD VAL/16"; how a word maps onto one register address is unknown, so show the raw byte.
  decode: u8,
  digits: 0,
  verified: false,
});

/** CU-301: auto climate control (tentative; raw values until checked on the car). */
export const CLIMATE_PARAMS: readonly ParamDef[] = [
  cl("ambient", "Ambient temp sensor (raw)", "AMB TEMP SEN", 0x20, "raw"),
  cl("inCarHead", "In-car sensor head (raw)", "IN-VEH SEN HD", 0x21, "raw"),
  cl("inCarFoot", "In-car sensor foot (raw)", "IN-VEH SEN FT", 0x22, "raw"),
  cl("defDuct", "Defrost duct (raw)", "DEF DUCT SEN", 0x23, "raw"),
  cl("ventDuct", "Vent duct (raw)", "VENT DUCT SEN", 0x24, "raw"),
  cl("floorDuct", "Floor duct (raw)", "FLOOR DUCT SEN", 0x25, "raw"),
  cl("sunload", "Sunload (raw)", "SUNLOAD SEN", 0x26, "raw"),
  cl("coolant", "Coolant temp (raw)", "COOLANT TEMP", 0x27, "raw"),
  cl("blower", "Blower motor (raw)", "BLOWER MOTOR", 0x2f, "raw"),
  { ...cl("compressor", "Compressor", "COMPRESSOR", 0x41, ""), kind: "onoff" },
  cl("setTemp", "Set temperature (raw)", "SET TEMP", 0x42, "raw"),
  {
    ...cl("multi1", "Modes (0x43)", "MULTI 1", 0x43, "bits"),
    kind: "bits",
    bitLabels: [null, null, "Fan low", "Fan high", "Recirculation", "Econ", "Defrost", "Auto"],
  },
];
