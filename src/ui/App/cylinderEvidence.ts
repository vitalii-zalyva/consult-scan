import type { CompressionEntry, CompressionSpec } from "@/analysis/compression";
import { evaluateCompression, latestPair } from "@/analysis/compression";
import type { PowerBalanceResult } from "@/analysis/power-balance";

/** CY-601: latest usable results for the diagnosis rule. */
export function cylinderEvidence(
  pb: PowerBalanceResult | undefined,
  entries: CompressionEntry[],
  spec: CompressionSpec,
) {
  const dry = latestPair(entries).dry;
  return {
    ...(pb ? { powerBalance: pb } : {}),
    ...(dry ? { compression: { date: dry.date, evaluation: evaluateCompression(dry, spec) } } : {}),
  };
}
