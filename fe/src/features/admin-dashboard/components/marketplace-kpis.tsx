import {
  IconChartBar,
  IconPackage,
  IconTrendingUp,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

// eslint-disable-next-line import/no-restricted-paths -- KPICard is an admin-dashboard-local UI building block; no shared equivalent exists yet.
import { KPICard } from "@/app/components/kpi-card";
import { formatPrice } from "@/shared/lib";

import type { AdminDashboardView } from "../model/dashboard-view";

interface MarketplaceKpisProps {
  values: AdminDashboardView["kpis"];
}

export function MarketplaceKpis({ values }: MarketplaceKpisProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        icon={IconTrendingUp}
        label={t("admin.dashboard.kpi.paidGmv")}
        value={values.gmvVnd !== null ? formatPrice(values.gmvVnd) : "N/A"}
        color="var(--primary)"
      />
      <KPICard
        icon={IconUsers}
        label={t("admin.dashboard.kpi.activeBuyers")}
        value={values.buyerCount !== null ? values.buyerCount.toLocaleString() : "N/A"}
        color="var(--info)"
      />
      <KPICard
        icon={IconTrendingUp}
        label={t("admin.dashboard.kpi.realizedRevenue")}
        value={values.realizedRevenueVnd !== null ? formatPrice(values.realizedRevenueVnd) : "N/A"}
        color="var(--success)"
      />
      <KPICard
        icon={IconChartBar}
        label={t("admin.dashboard.kpi.refundedAmount")}
        value={
          values.gmvVnd !== null ? "N/A" : "N/A"
        }
        color="var(--warning)"
      />
      <KPICard
        icon={IconPackage}
        label={t("admin.dashboard.kpi.paidOrders")}
        value={values.orderCount !== null ? values.orderCount.toLocaleString() : "N/A"}
        color="var(--accent)"
      />
      <KPICard
        icon={IconWallet}
        label={t("admin.dashboard.kpi.activeSellers")}
        value={
          values.activeSellerCount !== null ? values.activeSellerCount.toLocaleString() : "N/A"
        }
        color="var(--warning)"
      />
    </div>
  );
}
