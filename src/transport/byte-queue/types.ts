export interface Waiter {
  count: number;
  resolve: (bytes: Uint8Array) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}
