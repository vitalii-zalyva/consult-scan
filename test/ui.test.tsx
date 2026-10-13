import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { evaluateAll, VQ30DE_RULES } from "@/analysis";
import { ConsultError, PARAMS } from "@/protocol";
import { App } from "@/ui/App";
import { BitsPanel, FaultCodesPanel, LiveTable } from "@/ui/components";
import { describeError, describeProgress } from "@/ui/messages";

describe("LD-2xx: render smoke tests", () => {
  it("renders the app shell with the intro when disconnected", () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Consult Scan");
    expect(html).toContain("Getting started");
  });

  it("colours an out-of-range value and shows the reason (LD-202)", () => {
    const values = { rpm: 700, coolant: 85, timing: 5, mafLh: 1.3, bits13: 0b1000 };
    const html = renderToStaticMarkup(
      <>
        <LiveTable
          params={PARAMS}
          values={values}
          raw={{ timing: [0x69] }}
          evaluations={evaluateAll(values, "warm-idle", VQ30DE_RULES)}
          condition="warm-idle"
          history={[]}
        />
        <BitsPanel params={PARAMS} values={values} />
      </>,
    );
    const timingRow = html.match(/<tr class="st-(\w+)"(?:(?!<\/tr>).)*Ignition timing/s);
    expect(timingRow?.[1]).toBe("bad");
    expect(html).toContain("15° BTDC at idle");
    expect(html).toContain("0x08");
    expect(html).toContain("69"); // XD-102 raw byte
    expect(html).toContain("Power steering switch"); // XD-201 bit label (bit 3 set)
  });

  it("shows fault codes with present/past wording (FC-102)", () => {
    const html = renderToStaticMarkup(
      <FaultCodesPanel
        codes={[{ code: 12, name: "Mass air flow sensor circuit", startsSinceObserved: 0 }]}
        disabled={false}
        onRead={async () => {}}
        onClear={async () => {}}
      />,
    );
    expect(html).toContain("Present now");
  });
});

describe("LD-402: progress events and errors become UI text", () => {
  it("describes progress, known errors and passes unknown errors through", () => {
    expect(describeProgress({ kind: "detect", unit: "at", i: 3, n: 15 })).toMatch(/Transmission.*3\/15/);
    expect(describeError(new ConsultError("x", "init-failed"))).toMatch(/ignition/i);
    expect(describeError(new Error("raw failure"))).toBe("raw failure");
  });
});
