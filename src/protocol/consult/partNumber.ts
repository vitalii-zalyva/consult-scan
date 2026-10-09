// Spec: specs/001-consult-protocol/spec.md
import { hex } from "./commands";

/**
 * The D0 frame (22 bytes) ends with the ECU part-number suffix as ASCII,
 * e.g. ... 41 41 35 30 32 -> "23710-AA502". Bytes 2-3 are a ROM/calibration id.
 * Falls back to hex when the suffix is not printable (CP-202).
 */
export function formatPartNumber(frame: Uint8Array): string {
  if (frame.length < 22) return `unknown (${hex(frame)})`;
  const suffix = frame.subarray(17, 22);
  const printable = [...suffix].every((b) => b >= 0x20 && b < 0x7f);
  const romId = hex(frame.subarray(2, 4)).replace(" ", "").toUpperCase();
  return printable ? `23710-${String.fromCharCode(...suffix)} (ROM ${romId})` : `unknown (${hex(frame)})`;
}
