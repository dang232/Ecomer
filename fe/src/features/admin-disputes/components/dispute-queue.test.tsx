import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DisputeResolutionDialog } from "./dispute-resolution-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue,
    i18n: { language: "en" },
  }),
}));

describe("dispute-queue", () => {
  describe("DisputeResolutionDialog", () => {
    it("shows inline error when resolution is empty", () => {
      const onConfirm = vi.fn();
      render(
        <DisputeResolutionDialog
          disputeId="dispute-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
    });

    it("calls onConfirm with trimmed adminResolution when provided", () => {
      const onConfirm = vi.fn();
      render(
        <DisputeResolutionDialog
          disputeId="dispute-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "  50% refund  " } });
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(onConfirm).toHaveBeenCalledWith({ adminResolution: "50% refund" });
    });

    it("rejects whitespace-only adminResolution", () => {
      const onConfirm = vi.fn();
      render(
        <DisputeResolutionDialog
          disputeId="dispute-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: /submit/i }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});