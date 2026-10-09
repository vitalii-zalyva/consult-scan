import type { ConsultSession } from "@/protocol/session";

export interface CoveragePanelProps {
  session: ConsultSession;
  disabled: boolean;
  onChanged: () => void;
  onMessage: (msg: string) => void;
}
