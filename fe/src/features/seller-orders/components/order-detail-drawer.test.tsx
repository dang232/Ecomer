import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SellerOrderRow } from "../model/order-queue-view";

import { OrderDetailDrawer } from "./order-detail-drawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

function makeRow(overrides: Partial<SellerOrderRow> = {}): SellerOrderRow {
  return {
    id: "sub-1",
    orderId: "order-1",
    createdAt: "2026-07-29T10:00:00Z",
    status: "PENDING_ACCEPTANCE",
    itemCount: 1,
    itemSummary: "Widget x1",
    actions: ["accept", "reject"],
    ...overrides,
  };
}

describe("OrderDetailDrawer", () => {
  it("shows a truthful unavailable state when the seller order has no date", () => {
    render(<OrderDetailDrawer row={makeRow({ createdAt: undefined })} onClose={vi.fn()} />);

    expect(screen.getByText("seller.orders.detailDrawer.dateUnavailable")).toBeVisible();
    expect(screen.queryByText("Invalid Date")).not.toBeInTheDocument();
  });
});
