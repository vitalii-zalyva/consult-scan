// PreToolUse (Edit|MultiEdit|Write): keep car-facing writes inside the reviewed modules (CLAUDE.md "Safety rules").
import { block, changeOf, readEvent, relPath } from "./lib.mjs";

const event = readEvent();
const file = relPath(event.tool_input?.file_path ?? "");
if (!file.startsWith("src/")) process.exit(0);
const { added, removed } = changeOf(event.tool_input ?? {});

const inAny = (...prefixes) => prefixes.some((p) => file.startsWith(p));
const RULES = [
  {
    re: /\b0x[cC]9\b|\bROM_READ\b/,
    allowed: () => false,
    why: "ROM read (C9) needs its own approved spec.",
  },
  {
    re: /\.(setPowerBalance|powerBalanceStream)\s*\(/,
    allowed: () => inAny("src/protocol/consult/", "src/protocol/power-balance-runner/"),
    why: "Cylinder cuts (0A 88) may only be sent through PowerBalanceRunner and its interlocks (spec 012).",
  },
  {
    re: /\bCMD\.(ACTIVE_TEST|CLEAR_FAULT_CODES)\b|\btransport\.write\s*\(/,
    allowed: () => inAny("src/protocol/consult/", "src/transport/", "src/simulator/"),
    why: "Bytes that change ECU state are only built in the Consult client (src/protocol/consult).",
  },
];
for (const r of RULES) {
  if (r.re.test(added) && !r.allowed()) {
    block(
      `ECU safety guard: ${file} — ${r.why}\nIf this is intended, write or update the spec first and ask the user.`,
    );
  }
}
if (/assertPowerBalanceMask/.test(removed) && !/assertPowerBalanceMask/.test(added)) {
  block(
    `ECU safety guard: ${file} — this change removes assertPowerBalanceMask. The mask check must never be weakened.`,
  );
}
