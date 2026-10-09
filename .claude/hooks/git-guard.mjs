// PreToolUse (Bash): git safety for a public repository.
import fs from "node:fs";

import { block, readEvent } from "./lib.mjs";

const cmd = String(readEvent().tool_input?.command ?? "");
if (!/\bgit\b/.test(cmd)) process.exit(0);

if (/\bgit\s+push\b[^\n;&|]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S+)/.test(cmd))
  block("Git guard: force-push is not allowed. Ask the user.");
if (/--no-verify\b/.test(cmd)) block("Git guard: do not skip hooks (--no-verify).");
if (/\bgit\s+commit\b/.test(cmd) && /co-authored-by/i.test(cmd))
  block("Git guard: commits in this repo carry no Co-Authored-By trailer.");
if (/\bgit\s+add\b[^\n;&|]*(\.env\b|\blogs\/|\.vercel\b)/.test(cmd))
  block("Git guard: .env, logs/ and .vercel/ stay out of git (raw car logs and secrets).");
if (/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f)/.test(cmd))
  block("Git guard: destructive git command. Ask the user first.");

// Conventional Commits: "type(scope): subject", subject starting lowercase.
const TYPES = "feat|fix|chore|docs|refactor|test|ci|build|perf|style|revert";
const CONVENTIONAL = new RegExp(`(?:^|\\n|["'])\\s*(?:${TYPES})(?:\\([a-z0-9,-]+\\))?!?: [a-z0-9]`);
if (/\bgit\s+commit\b/.test(cmd) && !/--no-edit\b/.test(cmd)) {
  const file = cmd.match(/\s(?:-F|--file)\s+("[^"]+"|'[^']+'|\S+)/)?.[1]?.replace(/^["']|["']$/g, "");
  let message = cmd;
  if (file) {
    try {
      message = fs.readFileSync(file, "utf8");
    } catch {
      /* fall back to the command text */
    }
  }
  if (!CONVENTIONAL.test(message)) {
    block('Git guard: use Conventional Commits, e.g. "feat(ui): add fuel panel" or "fix(protocol): handle late CF".');
  }
}
