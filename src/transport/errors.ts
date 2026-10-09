// Spec: specs/002-transports/spec.md

export class TimeoutError extends Error {
  constructor(message = "Timed out waiting for ECU") {
    super(message);
    this.name = "TimeoutError";
  }
}
