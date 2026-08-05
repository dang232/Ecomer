import { Banknote, Package, ShoppingBag, Star, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";
import { Surface } from "@/shared/ui";

import type { SellerDashboardView } from "../model/dashboard-view";

interface SellerKpiStripProps {
  values: SellerDashboardView["kpis"];
  days: number;
  isLoading?: boolean;
}

interface Metric {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}

export function SellerKpiStrip({ values, days, isLoading = false }: SellerKpiStripProps) {
  const { t } = useTranslation();
  const unavailable = t("common.unavailable", { defaultValue: "-" });

  const metrics: Metric[] = [
    {
      id: "revenue",
      icon: TrendingUp,
      label: t("seller.dashboard.kpi.revenue", { days }),
      value: values.revenueVnd === null ? unavailable : formatPrice(values.revenueVnd),
      tone: "text-primary bg-primary-light",
    },
    {
      id: "orders",
      icon: ShoppingBag,
      label: t("seller.dashboard.kpi.orders", { days }),
      value: values.orderCount === null ? unavailable : values.orderCount.toLocaleString(),
      tone: "text-info bg-info-light",
    },
    {
      id: "balance",
      icon: Banknote,
      label: t("seller.dashboard.kpi.balance"),
      value:
        values.availableBalanceVnd === null ? unavailable : formatPrice(values.availableBalanceVnd),
      tone: "text-success bg-success-light",
    },
    {
      id: "products",
      icon: Package,
      label: t("seller.dashboard.kpi.products"),
      value: values.productCount === null ? unavailable : values.productCount.toLocaleString(),
      tone: "text-accent bg-warning-light",
    },
    {
      id: "rating",
      icon: Star,
      label: t("seller.dashboard.kpi.rating"),
      value:
        values.rating === null
          ? t("seller.dashboard.kpi.noRating")
          : `${values.rating.toFixed(1)}/5`,
      tone: "text-warning bg-warning-light",
    },
  ];

  return (
    <section aria-label={t("seller.dashboard.kpi.sectionLabel")}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Surface key={metric.id} padding="md" className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${metric.tone}`}
                >
                  <Icon size={18} aria-hidden="true" />
                </div>
                {isLoading && metric.value === unavailable ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t("common.loading", { defaultValue: "Loading" })}
                  </span>
                ) : null}
              </div>
              <p
                className="mt-4 truncate text-xl font-bold text-foreground"
                data-testid={`seller-kpi-${metric.id}`}
              >
                {metric.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.label}</p>
            </Surface>
          );
        })}
      </div>
    </section>
  );
}
