import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./dialog";

function DialogFixture({ dismissDisabled = false }: { dismissDisabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open editor
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit address"
        description="Update the delivery address"
        dismissDisabled={dismissDisabled}
        footer={<button type="button">Save address</button>}
      >
        <label htmlFor="street">Street</label>
        <input id="street" data-autofocus />
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("provides dialog semantics and moves focus to requested content", async () => {
    render(<DialogFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    expect(screen.getByRole("dialog", { name: "Edit address" })).toHaveAttribute(
      "aria-modal",
      "true",
    );
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Street" })).toHaveFocus());
  });

  it("does not dismiss when Enter or Space is pressed inside a form field", () => {
    render(<DialogFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    const input = screen.getByRole("textbox", { name: "Street" });

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: " " });
    expect(screen.getByRole("dialog", { name: "Edit address" })).toBeInTheDocument();
  });

  it("dismisses from Escape and restores focus to the trigger", async () => {
    render(<DialogFixture />);
    const trigger = screen.getByRole("button", { name: "Open editor" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("dismisses only when the backdrop itself is clicked", () => {
    render(<DialogFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    fireEvent.click(screen.getByText("Update the delivery address"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("dialog-backdrop"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks Escape and backdrop dismissal while an action is pending", () => {
    render(<DialogFixture dismissDisabled />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.mouseDown(screen.getByTestId("dialog-backdrop"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cycles focus inside the dialog", async () => {
    render(<DialogFixture />);
    fireEvent.click(screen.getByRole("button", { name: "Open editor" }));
    const input = screen.getByRole("textbox", { name: "Street" });
    const save = screen.getByRole("button", { name: "Save address" });

    await waitFor(() => expect(input).toHaveFocus());
    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveFocus();
  });

  it("supports a controlled close callback", () => {
    const onClose = vi.fn();
    render(
      <Dialog open onClose={onClose} title="Details">
        Content
      </Dialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
