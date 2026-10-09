// Stop: do not finish a turn while tests related to the uncommitted changes fail.
import { execFileSync } from "node:child_process";

import { projectDir, readEvent } from "./lib.mjs";

const event = readEvent();
if (event.stop_hook_active) process.exit(0); // already continuing because of this hook

const changed = execFileSync("git", ["status", "--porcelain"], { cwd: projectDir, encoding: "utf8" })
  .split("\n")
  .some((l) => /\s(src|test)\//.test(l));
if (!changed) process.exit(0);

try {
  execFileSync("npx", ["vitest", "run", "--changed", "HEAD", "--reporter=dot"], {
    cwd: projectDir,
    stdio: "pipe",
    encoding: "utf8",
  });
} catch (err) {
  const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.split("\n").slice(-40).join("\n");
  process.stderr.write(`Tests related to your changes fail. Fix them before finishing:\n${out}\n`);
  process.exit(2);
}
