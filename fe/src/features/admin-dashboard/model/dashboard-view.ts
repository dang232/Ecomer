/**
 * Dashboard view presenter.
 *
 * Maps raw endpoint shapes (DashboardSummary, DashboardReport, queue counts)
 * into AdminDashboardView. Failed queries leave their fields null — never
 * substitute zero.
 */

import type {
  DashboardReport,
  DashboardSummary,
  DashboardRevenuePoint,
  DashboardTopProduct,
  DashboardTopSeller,
} from "@/shared/contracts/api/admin";

export interface AdminDashboardView {
  kpis: {
    gmvVnd: number | null;
    realizedRevenueVnd: number | null;
    orderCount: number | null;
    activeSellerCount: number | null;
    buyerCount: number | null;
  };
  revenue: readonly {
    period: string;
    paidGmvVnd: number;
    refundedVnd: number;
    realizedRevenueVnd: number;
  }[];
  topProducts: readonly { id: string; name: string; unitsSold: number }[];
  topSellers: readonly { id: string; name: string | null; paidGmvVnd: number }[];
  exceptions: readonly {
    kind: "seller" | "review" | "video" | "dispute" | "payout";
    count: number;
    href: string;
  }[];
}

export interface DashboardViewInput {
  summary: DashboardSummary | null;
  report: DashboardReport | null;
  revenue: readonly DashboardRevenuePoint[];
  topProducts: readonly DashboardTopProduct[];
  topSellers: readonly DashboardTopSeller[];
  counts: {
    sellers: number;
    reviews: number;
    video: number;
    disputes: number;
    payouts: number;
  };
}

export function toAdminDashboardView(input: DashboardViewInput): AdminDashboardView {
  const { summary, revenue, topProducts, topSellers, counts } = input;

  return {
    kpis: {
      gmvVnd: summary?.paidGmv ?? null,
      realizedRevenueVnd: summary?.realizedRevenue ?? null,
      orderCount: summary?.totalOrders ?? null,
      activeSellerCount: summary?.activeSellers ?? null,
      buyerCount: summary?.activeBuyers ?? null,
    },
    revenue: revenue.map((p) => ({
      period: p.date,
      paidGmvVnd: p.paidGmv,
      refundedVnd: p.refundedAmount,
      realizedRevenueVnd: p.realizedRevenue,
    })),
    topProducts: topProducts.map((p) => ({
      id: p.productId,
      name: p.name,
      unitsSold: p.unitsSold,
    })),
    topSellers: topSellers.map((s) => ({
      id: s.sellerId,
      name: s.shopName,
      paidGmvVnd: s.paidGmv,
    })),
    exceptions: [
      { kind: "seller", count: counts.sellers, href: "/admin/sellers" },
      { kind: "review", count: counts.reviews, href: "/admin/reviews" },
      { kind: "video", count: counts.video, href: "/admin/video" },
      { kind: "dispute", count: counts.disputes, href: "/admin/disputes" },
      { kind: "payout", count: counts.payouts, href: "/admin/payouts" },
    ],
  };
}
