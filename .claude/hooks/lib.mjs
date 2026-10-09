// Shared helpers for Claude Code hooks: read the JSON event from stdin, block with a reason.
import fs from "node:fs";
import path from "node:path";

export function readEvent() {
  return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
}

/** Exit code 2 blocks the action; stderr is shown to Claude as the reason. */
export function block(reason) {
  process.stderr.write(reason.trim() + "\n");
  process.exit(2);
}

export const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
export const relPath = (file) => path.relative(projectDir, path.resolve(projectDir, file)).split(path.sep).join("/");

/** Text an Edit / MultiEdit / Write call adds, and the text it replaces. */
export function changeOf(toolInput) {
  if (typeof toolInput.content === "string") {
    let before = "";
    try {
      before = fs.readFileSync(path.resolve(projectDir, toolInput.file_path), "utf8");
    } catch {
      /* new file */
    }
    return { added: toolInput.content, removed: before };
  }
  const edits = Array.isArray(toolInput.edits) ? toolInput.edits : [toolInput];
  return {
    added: edits.map((e) => e.new_string ?? "").join("\n"),
    removed: edits.map((e) => e.old_string ?? "").join("\n"),
  };
}
