import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { SellerProfile } from "@/shared/contracts/api";

import type { SellerDashboardView } from "../model/dashboard-view";

import { SellerDashboard } from "./seller-dashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en" },
  }),
}));

const profile: SellerProfile = {
  id: "seller-1",
  shopName: "Seller One",
  bankName: "Example Bank",
  approved: true,
  tier: "STANDARD",
  vacationMode: false,
  destination: null,
};

const view: SellerDashboardView = {
  shopName: "Seller One",
  kpis: {
    revenueVnd: 1_250_000,
    orderCount: 14,
    productCount: 8,
    rating: 4.8,
    availableBalanceVnd: 500_000,
  },
  revenue: [{ date: "2026-07-29", revenueVnd: 1_250_000, orders: 14 }],
  urgentTasks: [
    { id: "order:sub-1", kind: "order", label: "sub-1", href: "/seller/orders" },
    { id: "return:return-1", kind: "return", label: "return-1", href: "/seller/returns" },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <SellerDashboard
        view={view}
        profile={profile}
        days={30}
        onDaysChange={vi.fn()}
        revenueLoading={false}
        revenueError={null}
        onRetryRevenue={vi.fn()}
        operationalLoading={false}
        operationalError={false}
        onRetryOperational={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SellerDashboard", () => {
  it("presents shop context, performance metrics, and operational tasks together", () => {
    renderDashboard();

    expect(screen.getByRole("heading", { name: "Seller One" })).toBeVisible();
    expect(screen.getByTestId("seller-kpi-revenue")).toHaveTextContent("1.250.000");
    expect(screen.getByTestId("seller-kpi-orders")).toHaveTextContent("14");
    expect(screen.getByTestId("seller-performance-chart")).toBeVisible();
    expect(screen.getByTestId("seller-urgent-tasks")).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: /seller\.dashboard\.openTask/i })[0],
    ).toHaveAttribute("href", "/seller/orders");
    expect(
      screen.getByRole("link", { name: /seller\.dashboard\.viewStorefront/i }),
    ).toHaveAttribute("href", "/sellers/seller-1");
  });

  it("keeps the attention queue honest when its sources fail", () => {
    render(
      <MemoryRouter>
        <SellerDashboard
          view={{ ...view, urgentTasks: [] }}
          profile={profile}
          days={30}
          onDaysChange={vi.fn()}
          revenueLoading={false}
          revenueError={null}
          onRetryRevenue={vi.fn()}
          operationalLoading={false}
          operationalError
          onRetryOperational={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("seller.dashboard.urgentError")).toBeVisible();
    expect(screen.queryByText("seller.dashboard.urgentEmpty")).not.toBeInTheDocument();
  });
});
