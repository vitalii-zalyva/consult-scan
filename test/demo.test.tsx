import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "@/ui/App";

const render = (demo: boolean) => renderToStaticMarkup(<App demo={demo} />);

describe("014 public demo", () => {
  it("DM-101: the local build has no demo banner", () => {
    expect(render(false)).not.toContain("Start demo");
  });

  it("DM-103: the demo preselects the simulator and keeps the cable sources", () => {
    const html = render(true);
    expect(html).toMatch(/<option value="simulator" selected="">/);
    expect(html).toContain('value="web-serial"');
    expect(html).toContain('value="web-usb-ftdi"');
  });

  it("DM-104, DM-105: the banner explains the project and offers the demo and the cable", () => {
    const html = render(true);
    expect(html).toContain("1998 Nissan Maxima");
    expect(html).toContain("Start demo");
    expect(html).toContain("Choose USB cable");
    expect(html).toContain("Getting started");
  });
});
