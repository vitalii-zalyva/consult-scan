// Spec: specs/007-data-logging/spec.md

export function downloadText(filename: string, text: string, mime = "text/csv"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function timestampForFile(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
