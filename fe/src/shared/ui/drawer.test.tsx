import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Drawer } from "./drawer";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open order
      </button>
      <Drawer open={open} title="Order details" onOpenChange={setOpen}>
        <button type="button">Action</button>
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("traps focus and returns it after closing", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open order" });
    opener.focus();
    fireEvent.click(opener);

    expect(screen.getByRole("dialog", { name: "Order details" })).toBeVisible();
    const action = screen.getByRole("button", { name: "Action" });
    await waitFor(() => expect(action).toHaveFocus());
    fireEvent.keyDown(action, { key: "Tab" });
    expect(screen.getByRole("button", { name: /close drawer/i })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("button", { name: /close drawer/i }), { key: "Tab" });
    expect(action).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Order details" })).not.toBeInTheDocument();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
