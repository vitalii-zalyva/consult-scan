import { readFileSync } from "node:fs";

import type { Sample } from "@/analysis";
import type { ParamValues } from "@/protocol";

/** Reads an app CSV export (header `id [unit]`, first column time_s) from test/fixtures into samples. */
export function loadCsv(name: string): Sample[] {
  const [head, ...rows] = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")
    .trim()
    .split("\n");
  const ids = head!.split(",").map((h) => h.split(" [")[0]!);
  return rows.map((row) => {
    const cells = row.split(",");
    const values: ParamValues = {};
    ids.forEach((id, i) => {
      if (i > 0 && cells[i] !== "") values[id] = Number(cells[i]);
    });
    return { t: Number(cells[0]) * 1000, values };
  });
}
