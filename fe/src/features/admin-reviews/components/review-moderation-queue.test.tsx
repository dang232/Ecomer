import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReviewDecisionDialog } from "./review-decision-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue,
    i18n: { language: "en" },
  }),
}));

describe("review-moderation-queue", () => {
  describe("ReviewDecisionDialog", () => {
    it("shows inline error when reject reason is empty", () => {
      const onConfirm = vi.fn();
      render(
        <ReviewDecisionDialog
          reviewId="review-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
    });

    it("calls onConfirm with trimmed reason when provided", () => {
      const onConfirm = vi.fn();
      render(
        <ReviewDecisionDialog
          reviewId="review-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "  spam  " } });
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
      expect(onConfirm).toHaveBeenCalledWith({ reason: "spam" });
    });

    it("rejects whitespace-only reason", () => {
      const onConfirm = vi.fn();
      render(
        <ReviewDecisionDialog
          reviewId="review-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});
