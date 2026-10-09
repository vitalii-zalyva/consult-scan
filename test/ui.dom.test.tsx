import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FaultCodeReading } from "@/protocol";
import { App } from "@/ui/App";
import { FaultCodesPanel } from "@/ui/components";

const CODE: FaultCodeReading = { code: 12, name: "Mass air flow sensor circuit", startsSinceObserved: 0 };

afterEach(() => vi.restoreAllMocks());

describe("LD-101: connect to the simulator from the UI", () => {
  it("connects, streams live values and disconnects", async () => {
    const user = userEvent.setup();
    render(<App />);
    // jsdom has no Web Serial, so the simulator is preselected (LD-1xx).
    await user.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Engine speed (POS)", undefined, { timeout: 8000 })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(await screen.findByRole("button", { name: "Connect" })).toBeInTheDocument();
  }, 15_000);
});

describe("FC-201: clearing fault codes needs confirmation", () => {
  const setup = () => {
    const onClear = vi.fn(async () => {});
    render(<FaultCodesPanel codes={[CODE]} disabled={false} onRead={async () => {}} onClear={onClear} />);
    return { onClear, user: userEvent.setup() };
  };

  it("does nothing when the user cancels", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { onClear, user } = setup();
    await user.click(screen.getByRole("button", { name: "Clear…" }));
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(onClear).not.toHaveBeenCalled();
  });

  it("clears after the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { onClear, user } = setup();
    await user.click(screen.getByRole("button", { name: "Clear…" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("disables Clear when there are no codes", () => {
    render(<FaultCodesPanel codes={[]} disabled={false} onRead={async () => {}} onClear={async () => {}} />);
    expect(screen.getByRole("button", { name: "Clear…" })).toBeDisabled();
  });
});
