// PostToolUse (Edit|MultiEdit|Write): format the file, then lint it and typecheck the project.
// Failures are fed back to Claude (exit 2) so they get fixed right away.
import { execFileSync } from "node:child_process";

import { projectDir, readEvent, relPath } from "./lib.mjs";

const event = readEvent();
const file = relPath(event.tool_input?.file_path ?? "");
if (!/^(src|test)\/.*\.(ts|tsx|css)$/.test(file)) process.exit(0);

const run = (cmd, args) => {
  try {
    execFileSync(cmd, args, { cwd: projectDir, stdio: "pipe", encoding: "utf8" });
    return "";
  } catch (err) {
    return `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
  }
};

run("npx", ["prettier", "--write", file]);
const problems = [];
if (/\.(ts|tsx)$/.test(file)) {
  const lint = run("npx", ["eslint", "--no-warn-ignored", file]);
  if (lint) problems.push(`ESLint:\n${lint}`);
  const tsc = run("npx", ["tsc", "--noEmit", "--pretty", "false"]);
  if (tsc) problems.push(`TypeScript:\n${tsc.split("\n").slice(0, 30).join("\n")}`);
}
if (problems.length) {
  process.stderr.write(`Checks failed after editing ${file}:\n\n${problems.join("\n\n")}\n`);
  process.exit(2);
}
