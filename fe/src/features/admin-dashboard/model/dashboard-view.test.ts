import { describe, expect, it } from "vitest";

import {
  dashboardReportSchema,
  dashboardTopSellerSchema,
} from "@/shared/contracts/api/admin";

import {
  toAdminDashboardView,
} from "./dashboard-view";

describe("toAdminDashboardView", () => {
  it("keeps unavailable metrics null and exposes operational exceptions", () => {
    const view = toAdminDashboardView({
      summary: null,
      report: null,
      revenue: [],
      topProducts: [],
      topSellers: [],
      counts: { sellers: 2, reviews: 3, disputes: 1, payouts: 4, video: 5 },
    });

    expect(view.kpis.gmvVnd).toBeNull();
    expect(view.kpis.realizedRevenueVnd).toBeNull();
    expect(view.kpis.orderCount).toBeNull();
    expect(view.kpis.activeSellerCount).toBeNull();
    expect(view.kpis.buyerCount).toBeNull();
    expect(view.exceptions).toEqual([
      { kind: "seller", count: 2, href: "/admin/sellers" },
      { kind: "review", count: 3, href: "/admin/reviews" },
      { kind: "video", count: 5, href: "/admin/video" },
      { kind: "dispute", count: 1, href: "/admin/disputes" },
      { kind: "payout", count: 4, href: "/admin/payouts" },
    ]);
  });

  it("maps only fields present in the dashboard report contract", () => {
    const reportFixture = dashboardReportSchema.parse({
      asOf: "2024-01-01T00:00:00Z",
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
      summary: {
        totalOrders: 1200,
        paidGmv: 500_000_000,
        refundedAmount: 5_000_000,
        realizedRevenue: 495_000_000,
        activeBuyers: 800,
        activeSellers: 100,
        avgPaidOrderValue: 416_666,
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
      },
      revenue: {
        points: [
          {
            date: "2024-01-01",
            paidGmv: 10_000_000,
            refundedAmount: 100_000,
            realizedRevenue: 9_900_000,
          },
        ],
      },
      topProducts: [
        {
          productId: "prod-1",
          name: "Test Product",
          unitsSold: 500,
        },
      ],
      topSellers: [
        {
          sellerId: "seller-1",
          shopName: "Test Shop",
          paidGmv: 50_000_000,
        },
      ],
    });

    const view = toAdminDashboardView({
      summary: reportFixture.summary,
      report: reportFixture,
      revenue: reportFixture.revenue.points,
      topProducts: reportFixture.topProducts,
      topSellers: reportFixture.topSellers,
      counts: { sellers: 0, reviews: 0, disputes: 0, payouts: 0, video: 0 },
    });

    expect(view.revenue[0]).toEqual({
      period: "2024-01-01",
      paidGmvVnd: 10_000_000,
      refundedVnd: 100_000,
      realizedRevenueVnd: 9_900_000,
    });
    expect(view.topProducts[0]).toMatchObject({ unitsSold: 500 });
    expect(view.topSellers[0]).toMatchObject({ paidGmvVnd: 50_000_000 });

    // KPIs must be null-safe
    expect(view.kpis.gmvVnd).toBe(500_000_000);
    expect(view.kpis.realizedRevenueVnd).toBe(495_000_000);
    expect(view.kpis.orderCount).toBe(1200);
    expect(view.kpis.activeSellerCount).toBe(100);
    expect(view.kpis.buyerCount).toBe(800);

    // Null summary case
    const nullView = toAdminDashboardView({
      summary: null,
      report: null,
      revenue: [],
      topProducts: [],
      topSellers: [],
      counts: { sellers: 0, reviews: 0, disputes: 0, payouts: 0, video: 0 },
    });
    expect(nullView.kpis.gmvVnd).toBeNull();
    expect(nullView.kpis.realizedRevenueVnd).toBeNull();
  });

  it("maps top sellers with null shopName", () => {
    const sellerSchema = dashboardTopSellerSchema.parse({
      sellerId: "seller-99",
      shopName: null,
      paidGmv: 1_000_000,
    });
    const view = toAdminDashboardView({
      summary: null,
      report: null,
      revenue: [],
      topProducts: [],
      topSellers: [sellerSchema],
      counts: { sellers: 0, reviews: 0, disputes: 0, payouts: 0, video: 0 },
    });
    expect(view.topSellers[0].name).toBeNull();
  });
});
