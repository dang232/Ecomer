/** Tests for ConfirmDialog primitive — reasonField prop + general dialog behavior */
import type { HTMLAttributes, ReactNode } from "react";
import { createElement } from "react";

// Mock AnimatePresence to render children synchronously in jsdom (motion/react defers)
vi.mock("motion/react", () => ({
  AnimatePresence: ({ children, mode: _mode }: { children: ReactNode; mode?: string }) => {
    // mode="wait" means keep previous child until new one is ready
    // We just render children directly (skip the animation/deferral)
    return children;
  },
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement> & { children?: ReactNode }) =>
      createElement("div", props, children),
  },
}));

/** Tests for ConfirmDialog primitive — reasonField prop + general dialog behavior */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog — primitive", () => {
  describe("reasonField", () => {
    it("renders a textarea when reasonField prop is true", async () => {
      render(
        <ConfirmDialog
          open
          title="Issue refund?"
          description="Please provide a reason."
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          reasonField
        />,
      );

      // AnimatePresence renders the dialog asynchronously
      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });
    });

    it("does NOT render a textarea when reasonField is false or omitted", async () => {
      render(
        <ConfirmDialog
          open
          title="Are you sure?"
          description="This action cannot be undone."
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("confirm button is disabled when reason textarea has fewer than 5 non-whitespace characters", async () => {
      render(
        <ConfirmDialog
          open
          variant="danger"
          title="Issue refund?"
          description="Please provide a reason."
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          reasonField
          confirmLabel="Refund"
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

    it("confirm button is enabled once reason textarea has 5+ non-whitespace characters", async () => {
      render(
        <ConfirmDialog
          open
          title="Issue refund?"
          description="Please provide a reason."
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          reasonField
          confirmLabel="Refund"
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

    it("calls onConfirm with trimmed reason and closes when confirm is clicked with sufficient reason", async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          open
          title="Issue refund?"
          description="Please provide a reason."
          onClose={onClose}
          onConfirm={onConfirm}
          reasonField
          confirmLabel="Refund"
        />,
      );

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        fireEvent.change(textarea, { target: { value: "  Item arrived damaged  " } });
        fireEvent.click(screen.getByRole("button", { name: /Refund/i }));
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
          title="Issue refund?"
          description="Please provide a reason."
          onClose={vi.fn()}
          onConfirm={onConfirm}
          reasonField
          confirmLabel="Refund"
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
  });

  describe("variant styling", () => {
    it("applies danger variant (bg-error) for destructive actions", async () => {
      render(
        <ConfirmDialog
          open
          title="Destructive?"
          description="Are you sure?"
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          variant="danger"
          confirmLabel="Delete"
        />,
      );

      await waitFor(() => {
        const confirmBtn = screen.getByRole("button", { name: /Delete/i });
        expect(confirmBtn.className).toContain("bg-error");
      });
    });

    it("applies primary variant (bg-primary) for warning/non-destructive actions", async () => {
      render(
        <ConfirmDialog
          open
          title="Warning?"
          description="Are you sure?"
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          variant="warning"
          confirmLabel="Continue"
        />,
      );

      await waitFor(() => {
        const confirmBtn = screen.getByRole("button", { name: /Continue/i });
        expect(confirmBtn.className).toContain("bg-primary");
      });
    });
  });

  describe("general behavior", () => {
    it("calls onClose when the cancel button is clicked", async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          open
          title="Are you sure?"
          description="This action cannot be undone."
          onClose={onClose}
          onConfirm={onConfirm}
          cancelLabel="Keep"
          confirmLabel="Delete"
        />,
      );

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: /Keep/i }));
        expect(onClose).toHaveBeenCalled();
        expect(onConfirm).not.toHaveBeenCalled();
      });
    });

    it("renders the title and description correctly", async () => {
      render(
        <ConfirmDialog
          open
          title="Cancel order?"
          description="This will cancel your order and release the reservation."
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /Cancel order?/i })).toBeInTheDocument();
        expect(
          screen.getByText("This will cancel your order and release the reservation."),
        ).toBeInTheDocument();
      });
    });

    it("calls onConfirm with no argument when reasonField is false", async () => {
      const onClose = vi.fn();
      const onConfirm = vi.fn();

      render(
        <ConfirmDialog
          open
          title="Are you sure?"
          description="This action cannot be undone."
          onClose={onClose}
          onConfirm={onConfirm}
          confirmLabel="Delete"
        />,
      );

      await waitFor(() => {
        fireEvent.click(screen.getByRole("button", { name: /Delete/i }));
        expect(onConfirm).toHaveBeenCalledWith(undefined);
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
