import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SellerDecisionDialog } from "./seller-decision-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue,
    i18n: { language: "en" },
  }),
}));

describe("seller-approval-queue", () => {
  describe("SellerDecisionDialog", () => {
    it("renders approve dialog without reason field", () => {
      render(
        <SellerDecisionDialog
          variant="approve"
          sellerId="seller-1"
          shopName="Alice Shop"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />,
      );
      expect(screen.getByText(/approve seller/i)).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("renders reject dialog with reason textarea", () => {
      render(
        <SellerDecisionDialog
          variant="reject"
          sellerId="seller-1"
          shopName="Alice Shop"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />,
      );
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("shows inline error and keeps dialog open when reject reason is empty", () => {
      const onConfirm = vi.fn();
      render(
        <SellerDecisionDialog
          variant="reject"
          sellerId="seller-1"
          shopName="Alice Shop"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      const confirmBtn = screen.getByRole("button", { name: /reject/i });
      fireEvent.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(screen.getByText(/reason is required/i)).toBeInTheDocument();
    });

    it("calls onConfirm with trimmed reason when reject reason is provided", () => {
      const onConfirm = vi.fn();
      render(
        <SellerDecisionDialog
          variant="reject"
          sellerId="seller-1"
          shopName="Alice Shop"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "  not compliant  " } });
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
      expect(onConfirm).toHaveBeenCalledWith({ reason: "not compliant" });
    });

    it("rejects whitespace-only reject reason", () => {
      const onConfirm = vi.fn();
      render(
        <SellerDecisionDialog
          variant="reject"
          sellerId="seller-1"
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "   " } });
      fireEvent.click(screen.getByRole("button", { name: /reject/i }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });
});