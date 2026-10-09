// Spec: specs/001-consult-protocol/spec.md
import { CYLINDERS } from "./constants";

/** CY-101/CY-104: only "all firing" (0) or exactly one of the six cylinders may be cut. */
export function assertPowerBalanceMask(mask: number): void {
  const valid = Number.isInteger(mask) && mask >= 0 && mask < 1 << CYLINDERS && (mask & (mask - 1)) === 0;
  if (!valid) throw new Error(`Refusing power-balance mask 0x${mask.toString(16)}: only one cylinder may be cut`);
}

export const cylinderMask = (cylinder: number) => {
  if (!Number.isInteger(cylinder) || cylinder < 1 || cylinder > CYLINDERS)
    throw new Error(`Invalid cylinder ${cylinder}`);
  return 1 << (cylinder - 1);
};
