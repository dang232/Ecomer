/** Tests for P0-10: admin refund requires reason dialog — testing ConfirmDialog in isolation */
import type { HTMLAttributes, ReactNode } from "react";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../../components/ui/confirm-dialog";

// Mock AnimatePresence so dialog renders synchronously in jsdom
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("OrderManagement — P0-10 refund reason dialog (ConfirmDialog isolation)", () => {
  it("shows the reason dialog with textarea when reasonField is true", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="This will return the full amount to the buyer."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Issue refund\?/i })).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  it("confirm button is disabled when reason is fewer than 5 characters", async () => {
    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="Reason required."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      fireEvent.change(textarea, { target: { value: "bad" } });
      const confirmBtn = screen.getByRole("button", { name: /Refund/i });
      expect(confirmBtn).toBeDisabled();
    });
  });

  it("confirm button is enabled once reason has 5+ characters", async () => {
    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="Reason required."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
      fireEvent.change(textarea, { target: { value: "Item arrived damaged" } });
      const confirmBtn = screen.getByRole("button", { name: /Refund/i });
      expect(confirmBtn).not.toBeDisabled();
    });
  });

  it("calls onConfirm with the reason string when confirm is clicked with sufficient reason", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="Reason required."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Item arrived damaged" } });
      const confirmBtn = screen.getByRole("button", { name: /Refund/i });
      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledWith("Item arrived damaged");
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("does NOT call onConfirm when confirm is clicked with insufficient reason", async () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="Reason required."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "bad" } });
      const confirmBtn = screen.getByRole("button", { name: /Refund/i });
      expect(confirmBtn).toBeDisabled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  it("closes the dialog without calling onConfirm when cancel is clicked", async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        open
        variant="danger"
        reasonField
        title="Issue refund?"
        description="Reason required."
        confirmLabel="Refund"
        cancelLabel="Cancel"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    await waitFor(() => {
      const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalled();
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
