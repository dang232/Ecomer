import type { PendingSubOrder } from "@/shared/api/endpoints/orders";
import type { SellerRevenuePoint } from "@/shared/api/endpoints/seller-analytics";
import type { Payout, Wallet } from "@/shared/contracts/api";
import type { PublicSeller, SellerProfile } from "@/shared/contracts/api/seller";

export interface SellerProfileView {
  id: string;
  shopName: string;
  approved: boolean;
  tier: string;
  vacationMode: boolean;
  bankName: string | null;
  maskedDestination: { destinationId: string; bankName: string; last4: string } | null;
}

export interface DashboardRevenuePoint {
  date: string;
  revenueVnd: number;
  orders: number;
}

export type UrgentTaskKind = "order" | "inventory" | "payout";

export interface UrgentTask {
  id: string;
  kind: UrgentTaskKind;
  label: string;
  href: string;
}

export interface SellerDashboardView {
  shopName: string;
  kpis: {
    revenueVnd: number | null;
    orderCount: number | null;
    productCount: number | null;
    rating: number | null;
    availableBalanceVnd: number | null;
  };
  revenue: readonly DashboardRevenuePoint[];
  urgentTasks: readonly UrgentTask[];
}

export interface DashboardInputs {
  profile: SellerProfileView | SellerProfile;
  publicStats: PublicSeller | null;
  pendingOrders: readonly PendingSubOrder[];
  wallet: Wallet | null | undefined;
  payouts: readonly Payout[];
  revenue: readonly SellerRevenuePoint[];
}

// Internal coercion: the dashboard query layer sometimes has a wire
// `SellerProfile` and sometimes a presenter-shaped `SellerProfileView` (e.g.
// when called directly from a Storybook fixture). They share fields, so we
// tolerate both without forcing every call-site to construct the view.
function asProfileView(profile: SellerProfileView | SellerProfile): SellerProfileView {
  const candidate =
    "maskedDestination" in profile ? profile.maskedDestination : profile.destination;
  const maskedDestination =
    candidate === null
      ? null
      : {
          destinationId: candidate.destinationId,
          bankName: candidate.bankName,
          last4: candidate.last4,
        };
  return {
    id: profile.id,
    shopName: profile.shopName,
    approved: profile.approved,
    tier: profile.tier,
    vacationMode: profile.vacationMode,
    bankName: profile.bankName ?? null,
    maskedDestination,
  };
}

export function toSellerDashboardView(inputs: DashboardInputs): SellerDashboardView {
  const profile = asProfileView(inputs.profile);

  const revenueTotal = inputs.revenue.reduce((sum, point) => sum + point.revenue, 0);
  const orderCount = inputs.revenue.reduce((sum, point) => sum + point.orderCount, 0);

  const tasks: UrgentTask[] = [];
  for (const order of inputs.pendingOrders) {
    if (order.status === "PENDING_ACCEPTANCE") {
      tasks.push({
        id: `order:${order.id}`,
        kind: "order",
        label: order.id,
        href: "/seller/orders",
      });
    }
  }
  for (const payout of inputs.payouts) {
    if (payout.status === "FAILED" || payout.status === "REJECTED" || payout.status === "REVERSED") {
      tasks.push({
        id: `payout:${payout.id}`,
        kind: "payout",
        label: payout.id,
        href: "/seller/wallet",
      });
    }
  }

  return {
    shopName: profile.shopName,
    kpis: {
      revenueVnd: inputs.revenue.length === 0 ? null : revenueTotal,
      orderCount: inputs.revenue.length === 0 ? null : orderCount,
      productCount: inputs.publicStats?.totalProducts ?? null,
      rating: inputs.publicStats?.ratingAvg ?? null,
      availableBalanceVnd: inputs.wallet?.balance ?? null,
    },
    revenue: inputs.revenue.map((point) => ({
      date: point.date,
      revenueVnd: point.revenue,
      orders: point.orderCount,
    })),
    urgentTasks: tasks,
  };
}
