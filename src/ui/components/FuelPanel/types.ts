import type { FuelSettings, TripState } from "@/analysis/fuel";
import type { ParamValues } from "@/protocol/registers";

export interface FuelPanelProps {
  values: ParamValues;
  trip: TripState;
  settings: FuelSettings;
  onReset: () => void;
  /** Returns a translated error message, or null on success. */
  onCalibrate: (pumpedLitres: number) => string | null;
  onSettings: (s: FuelSettings) => void;
}
