import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SellerOrderRow } from "../model/order-queue-view";

import { OrderQueue } from "./order-queue";

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

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

describe("OrderQueue", () => {
  it("renders the search input in the toolbar", () => {
    renderWithClient(
      <OrderQueue
        orders={[]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
  });

  it("renders a row with accept and reject buttons for PENDING_ACCEPTANCE", () => {
    renderWithClient(
      <OrderQueue
        orders={[makeRow()]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /accept/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /reject/i })).toBeVisible();
  });

  it("exposes order detail as a separate keyboard-accessible control", () => {
    const onRouteChange = vi.fn();
    renderWithClient(
      <OrderQueue
        orders={[makeRow()]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={onRouteChange}
      />,
    );

    const detailButton = screen.getByRole("button", { name: "seller.orders.openDetail" });
    expect(detailButton).toBeVisible();
    fireEvent.click(detailButton);
    expect(onRouteChange).toHaveBeenCalledWith({ selected: "sub-1" });
  });

  it("renders a row with a ship button for ACCEPTED", () => {
    renderWithClient(
      <OrderQueue
        orders={[makeRow({ status: "ACCEPTED", actions: ["ship"] })]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /ship/i })).toBeVisible();
  });

  it("renders no action buttons for SHIPPED status", () => {
    renderWithClient(
      <OrderQueue
        orders={[makeRow({ status: "SHIPPED", actions: [] })]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ship/i })).not.toBeInTheDocument();
  });

  it("renders empty state when no orders", () => {
    renderWithClient(
      <OrderQueue
        orders={[]}
        isLoading={false}
        error={null}
        routeState={{ q: "", selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByText("seller.orders.empty")).toBeVisible();
  });
});
