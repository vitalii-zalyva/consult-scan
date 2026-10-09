// PreToolUse (Edit|MultiEdit|Write): keep car-facing writes inside the reviewed modules (CLAUDE.md "Safety rules").
import { block, changeOf, readEvent, relPath } from "./lib.mjs";

const event = readEvent();
const file = relPath(event.tool_input?.file_path ?? "");
if (!file.startsWith("src/")) process.exit(0);
const { added } = changeOf(event.tool_input ?? {});

const inAny = (...prefixes) => prefixes.some((p) => file.startsWith(p));
const RULES = [
  {
    re: /\b0x[cC]9\b|\bROM_READ\b/,
    allowed: () => false,
    why: "ROM read (C9) needs its own approved spec.",
  },
  {
    re: /\bACTIVE_TEST\b|\b0x0[aA]\s*,\s*0x[0-9a-fA-F]{2}\s*,/,
    allowed: () => false,
    why: "Active tests (0A) change engine behaviour. None is approved; it needs a safety-reviewed spec first.",
  },
  {
    re: /\bCMD\.CLEAR_FAULT_CODES\b|\btransport\.write\s*\(/,
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
