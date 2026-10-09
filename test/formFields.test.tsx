import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "@/ui/App";

describe("LD-208: form fields", () => {
  it("gives every input and select a name and labels the source selector", () => {
    const html = renderToStaticMarkup(<App />);
    const fields = html.match(/<(input|select)\b[^>]*>/g) ?? [];
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) expect(f).toMatch(/ name="[^"]+"/);
    expect(html).toContain('aria-label="Connection"');
  });
});
