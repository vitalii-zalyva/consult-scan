/**
 * Fallback transport: talks to an FTDI FT232-family chip directly over WebUSB,
 * bypassing the macOS driver. Needed for cables with custom VID/PID that the
 * built-in AppleUSBFTDI driver does not bind to.
 * Spec: specs/002-transports/spec.md (TR-2xx)
 */
export const SIO_RESET = 0x00;
export const SIO_SET_MODEM_CTRL = 0x01;
export const SIO_SET_FLOW_CTRL = 0x02;
export const SIO_SET_BAUD_RATE = 0x03;
export const SIO_SET_DATA = 0x04;
export const SIO_SET_LATENCY_TIMER = 0x09;

/** 3 MHz / 9600 = 312.5 -> divisor 312 with 0.5 fraction code (1 << 14). */
export const BAUD_9600_VALUE = 0x4138;
export const DATA_8N1 = 0x0008;
export const MODEM_DTR_RTS_ON = 0x0303;
export const PACKET_STATUS_BYTES = 2;
