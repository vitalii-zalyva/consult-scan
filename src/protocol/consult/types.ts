// Spec: specs/001-consult-protocol/spec.md

export interface ConsultTimings {
  initTimeoutMs: number;
  initAttempts: number;
  byteTimeoutMs: number;
  frameTimeoutMs: number;
  /** Silence that marks the ECU idle after STOP / an error. */
  quietMs: number;
}

/** LD-402: known failures carry a code the UI turns into a message. */
export type ConsultErrorCode = "init-failed" | "unit-init-failed" | "clear-not-allowed" | "protocol";

export interface StreamHandle {
  /** Resolves once the ECU acknowledged the stop (or the stream failed). */
  stop(): Promise<void>;
  readonly done: Promise<void>;
}
