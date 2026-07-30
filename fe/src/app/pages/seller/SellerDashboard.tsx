import {
  IconPackage,
  IconShoppingBag,
  IconStar,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useSellerRevenue } from "../../hooks/use-seller-revenue";
import { ApiError } from "@/shared/api";
import type { PendingSubOrder } from "@/shared/api/endpoints/orders";
import type { SellerRevenuePoint } from "@/shared/api/endpoints/seller-analytics";
import { formatPrice } from "@/shared/lib";

interface RevenueChartPoint {
  day: string;
  revenue: number;
  orders: number;
}

function dateToWeekdayLabel(iso: string): string {
  const labels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return labels[d.getDay()] ?? iso;
}

function toChartData(points: SellerRevenuePoint[]): RevenueChartPoint[] {
  return points.map((p) => ({
    day: dateToWeekdayLabel(p.date),
    revenue: Number(p.revenue) || 0,
    orders: p.orderCount,
  }));
}

interface KpiCardODProps {
  icon: typeof IconWallet;
  label: string;
  value: string;
  trend?: string;
  positive?: boolean;
}

function KpiCardOD({ icon: Icon, label, value, trend, positive = true }: KpiCardODProps) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius-lg)] p-5 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 bg-primary-light rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
          <Icon size={20} className="text-primary" aria-hidden="true" />
        </div>
        {trend ? (
          <span
            className={[
              "text-[11px] font-semibold px-2 py-0.5 rounded-full",
              positive ? "bg-success-light text-success" : "bg-error-light text-error",
            ].join(" ")}
          >
            {trend}
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

export function SellerDashboard({
  pendingOrders,
  walletBalance,
  productCount,
  ratingAvg,
  statsLoading,
}: {
  pendingOrders: PendingSubOrder[];
  walletBalance: number | null;
  productCount: number | null;
  ratingAvg: number | null;
  statsLoading: boolean;
}) {
  const { points, isLoading: revenueLoading, error: revenueError } = useSellerRevenue({ days: 30 });
  const chartData = useMemo(() => toChartData(points), [points]);
  const hasRevenue = chartData.length > 0;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const retryRevenue = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["seller", "revenue", { days: 30 }] }),
    [queryClient],
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCardOD
          icon={IconWallet}
          label={t("seller.dashboard.kpi.balance")}
          value={walletBalance !== null ? formatPrice(walletBalance) : "—"}
        />
        <KpiCardOD
          icon={IconShoppingBag}
          label={t("seller.dashboard.kpi.pending")}
          value={String(pendingOrders.length)}
        />
        <KpiCardOD
          icon={IconPackage}
          label={t("seller.dashboard.kpi.products")}
          value={statsLoading ? "..." : String(productCount ?? 0)}
        />
        <KpiCardOD
          icon={IconStar}
          label={t("seller.dashboard.kpi.rating")}
          value={
            statsLoading
              ? "..."
              : ratingAvg === null
                ? t("seller.dashboard.kpi.noRating")
                : ratingAvg.toFixed(1)
          }
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-[var(--radius-lg)] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <IconTrendingUp size={18} className="text-primary" aria-hidden="true" />
            <h3 className="font-bold text-foreground">{t("seller.dashboard.revenue30dTitle")}</h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {t("seller.dashboard.revenue30dHint")}
          </span>
        </div>
        {revenueError instanceof ApiError ? (
          <div className="rounded-[var(--radius-md)] bg-error-light border border-error/20 px-4 py-3 text-sm text-error">
            <p>{t("seller.dashboard.revenue30dError", { message: revenueError.message })}</p>
            <button
              type="button"
              onClick={retryRevenue}
              className="mt-2 text-xs font-medium underline underline-offset-2 hover:text-error/80 transition-colors"
            >
              {t("seller.dashboard.revenue30dRetry", { defaultValue: "Thử lại" })}
            </button>
          </div>
        ) : revenueLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">
            {t("seller.dashboard.revenue30dLoading")}
          </p>
        ) : hasRevenue ? (
          <div data-testid="seller-revenue-chart">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(v: number) => `${(v / 1000000).toFixed(0)}tr`}
                />
                <Tooltip
                  formatter={(v: number) => formatPrice(v)}
                  contentStyle={{
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-lg)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-12 text-center">
            {t("seller.dashboard.revenue30dEmpty")}
          </p>
        )}
      </div>

      {/* Orders chart */}
      <div className="bg-card border border-border rounded-[var(--radius-lg)] p-5">
        <h3 className="font-bold text-foreground mb-4">{t("seller.dashboard.orders30dTitle")}</h3>
        {revenueLoading ? (
          <p className="text-sm text-muted-foreground py-10 text-center">
            {t("seller.dashboard.orders30dLoading")}
          </p>
        ) : hasRevenue ? (
          <div data-testid="seller-orders-chart">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-lg)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                />
                <Bar dataKey="orders" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">
            {t("seller.dashboard.orders30dEmpty")}
          </p>
        )}
      </div>
    </div>
  );
}
