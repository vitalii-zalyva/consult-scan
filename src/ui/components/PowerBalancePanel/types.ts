import type { PowerBalanceResult } from "@/analysis/power-balance";
import type { ConsultSession } from "@/protocol/session";

export interface PowerBalancePanelProps {
  session: ConsultSession;
  connected: boolean;
  isEngine: boolean;
  onResult: (r: PowerBalanceResult) => void;
}

export interface BarRow {
  cylinder: number;
  drop: number;
  status: "ok" | "warn" | "bad" | "na";
  pct?: number;
  aacRise?: number;
}
