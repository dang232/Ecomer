import { describe, expect, it } from "vitest";

import type { PendingSubOrder } from "@/shared/api/endpoints/orders";
import type { PublicSeller, Payout, Wallet } from "@/shared/contracts/api";

import { toSellerDashboardView } from "./dashboard-view";

describe("toSellerDashboardView", () => {
  it("derives urgent work and keeps missing metrics explicit", () => {
    const view = toSellerDashboardView({
      profile: {
        id: "s-1",
        shopName: "Shop A",
        bankName: "Vietcombank",
        approved: true,
        tier: "STANDARD",
        vacationMode: false,
        destination: null,
      },
      publicStats: null,
      pendingOrders: [{ id: "sub-1", status: "PENDING_ACCEPTANCE", items: [] }] as PendingSubOrder[],
      wallet: { balance: 500_000 } as Wallet,
      payouts: [
        {
          id: "pay-1",
          amount: 100_000,
          status: "FAILED",
          requestedAt: "2026-07-30T00:00:00Z",
        },
      ] as Payout[],
      revenue: [],
    });

    expect(view.shopName).toBe("Shop A");
    expect(view.kpis.productCount).toBeNull();
    expect(view.urgentTasks.map((task) => task.kind)).toEqual(["order", "payout"]);
  });

  it("uses the requested revenue window without synthesizing points", () => {
    const view = toSellerDashboardView({
      profile: {
        id: "s-2",
        shopName: "Shop B",
        bankName: null,
        approved: true,
        tier: "STANDARD",
        vacationMode: false,
        destination: null,
      },
      publicStats: { totalProducts: 12, ratingAvg: 4.6 } as unknown as PublicSeller,
      pendingOrders: [],
      wallet: { balance: 0 } as Wallet,
      payouts: [],
      revenue: [{ date: "2026-07-29", revenue: 20, orderCount: 1 }],
    });

    expect(view.revenue).toEqual([
      { date: "2026-07-29", revenueVnd: 20, orders: 1 },
    ]);
  });
});
