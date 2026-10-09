import type { ConsultSession } from "@/protocol/session";
import { deepScanKey } from "@/ui/components";

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

/** XD-303: reuse an earlier deep-scan result for this ECU + unit. */
export function restoreDeepScan(session: ConsultSession): void {
  try {
    const saved = localStorage.getItem(deepScanKey(session.partNumber, session.unit));
    if (saved) session.applyDeepScan(JSON.parse(saved) as number[]);
  } catch {
    /* storage unavailable or corrupt */
  }
}
