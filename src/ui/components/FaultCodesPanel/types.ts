import type { FaultCodeReading } from "@/protocol/fault-codes";

export interface FaultCodesPanelProps {
  title?: string;
  /** CU-104: clearing only for units that allow it. */
  canClear?: boolean;
  codes: FaultCodeReading[] | null;
  disabled: boolean;
  onRead: () => Promise<void>;
  onClear: () => Promise<void>;
}
