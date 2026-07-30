import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { AdminOrderSummary } from "@/shared/contracts/api";

import { toOrderView } from "../model/order-view";

import { OrderDecisionDialog } from "./order-decision-dialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue,
    i18n: { language: "en" },
  }),
}));

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>
  );
}

describe("order-queue", () => {
  describe("toOrderView", () => {
    it("maps raw order summary to view", () => {
      const raw = {
        orderId: "o-1",
        orderNumber: "ORD-001",
        buyerId: "b-1",
        buyerName: "Alice",
        sellerId: "s-1",
        sellerName: "Bob Shop",
        status: "PENDING_ACCEPTANCE",
        totalAmount: 150000,
        itemCount: 3,
        createdAt: "2026-01-15T10:00:00Z",
        updatedAt: null,
      };
      const view = toOrderView(raw as unknown as AdminOrderSummary);
      expect(view.id).toBe("o-1");
      expect(view.orderNumber).toBe("ORD-001");
      expect(view.buyerName).toBe("Alice");
      expect(view.status).toBe("PENDING_ACCEPTANCE");
    });

    it("handles null optional fields", () => {
      const raw = {
        orderId: "o-2",
        orderNumber: null,
        buyerId: "b-2",
        buyerName: null,
        sellerId: null,
        sellerName: null,
        status: "CANCELLED",
        totalAmount: 0,
        itemCount: 0,
        createdAt: null,
        updatedAt: null,
      };
      const view = toOrderView(raw as unknown as AdminOrderSummary);
      expect(view.orderNumber).toBeNull();
      expect(view.buyerName).toBeNull();
    });
  });

  describe("OrderDecisionDialog", () => {
    it("renders cancel dialog without reason field", () => {
      render(
        <TestWrapper>
          <OrderDecisionDialog
            variant="cancel"
            orderId="o-1"
            orderNumber="ORD-001"
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </TestWrapper>,
      );
      expect(screen.getByText(/cancel order/i)).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("renders refund dialog with reason field", () => {
      render(
        <TestWrapper>
          <OrderDecisionDialog
            variant="refund"
            orderId="o-1"
            orderNumber="ORD-001"
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </TestWrapper>,
      );
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("renders change-status dialog with status selector", () => {
      render(
        <TestWrapper>
          <OrderDecisionDialog
            variant="change-status"
            orderId="o-1"
            orderNumber="ORD-001"
            onConfirm={() => undefined}
            onCancel={() => undefined}
          />
        </TestWrapper>,
      );
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
    });
  });
});
