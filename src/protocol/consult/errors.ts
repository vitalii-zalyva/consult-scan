// Spec: specs/001-consult-protocol/spec.md
import type { ConsultErrorCode } from "./types";

export class ConsultError extends Error {
  constructor(
    message: string,
    readonly code: ConsultErrorCode = "protocol",
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ConsultError";
  }
}

export class UnsupportedRegisterError extends ConsultError {
  constructor(public readonly register: number) {
    super(`ECU does not support register 0x${register.toString(16).padStart(2, "0")}`);
    this.name = "UnsupportedRegisterError";
  }
}
