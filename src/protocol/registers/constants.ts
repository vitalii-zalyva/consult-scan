// Spec: specs/001-consult-protocol/spec.md (CP-4xx), specs/008-extended-data/spec.md (XD-1xx, XD-2xx)

/** Bit labels from the PLMS table (index = bit number). Positions read from the PDF layout; unverified. */
export const BIT_LABELS = {
  0x13: [
    "Closed throttle",
    "Start signal",
    "Park/Neutral switch",
    "Power steering switch",
    "A/C switch",
    null,
    null,
    null,
  ],
  0x1e: ["Fan low", "Fan high", null, null, null, "VTC solenoid", "Fuel pump relay", "A/C relay"],
  0x1f: ["EGR solenoid", null, null, "IACV-FICD solenoid", null, "Wastegate solenoid", "P/Reg control valve", null],
  0x21: [null, null, null, null, null, null, "Bank 2 lean", "Bank 1 lean"],
} as const;

/** Consult-I limits a live-data stream to 20 register bytes per frame. */
export const MAX_REGISTERS_PER_STREAM = 20;
