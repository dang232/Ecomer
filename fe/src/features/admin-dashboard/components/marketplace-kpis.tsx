import {
  BarChart3,
  Package,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";

import type { AdminDashboardView } from "../model/dashboard-view";

interface MarketplaceKpisProps {
  values: AdminDashboardView["kpis"];
}

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}

function KpiCard({ icon: Icon, label, value, color }: KpiCardProps) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${color}15` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function MarketplaceKpis({ values }: MarketplaceKpisProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KpiCard
        icon={TrendingUp}
        label={t("admin.dashboard.kpi.paidGmv")}
        value={values.gmvVnd !== null ? formatPrice(values.gmvVnd) : "N/A"}
        color="var(--primary)"
      />
      <KpiCard
        icon={Users}
        label={t("admin.dashboard.kpi.activeBuyers")}
        value={values.buyerCount !== null ? values.buyerCount.toLocaleString() : "N/A"}
        color="var(--info)"
      />
      <KpiCard
        icon={TrendingUp}
        label={t("admin.dashboard.kpi.realizedRevenue")}
        value={values.realizedRevenueVnd !== null ? formatPrice(values.realizedRevenueVnd) : "N/A"}
        color="var(--success)"
      />
      <KpiCard
        icon={BarChart3}
        label={t("admin.dashboard.kpi.refundedAmount")}
        value={
          values.gmvVnd !== null ? "N/A" : "N/A"
        }
        color="var(--warning)"
      />
      <KpiCard
        icon={Package}
        label={t("admin.dashboard.kpi.paidOrders")}
        value={values.orderCount !== null ? values.orderCount.toLocaleString() : "N/A"}
        color="var(--accent)"
      />
      <KpiCard
        icon={Wallet}
        label={t("admin.dashboard.kpi.activeSellers")}
        value={
          values.activeSellerCount !== null ? values.activeSellerCount.toLocaleString() : "N/A"
        }
        color="var(--warning)"
      />
    </div>
  );
}
