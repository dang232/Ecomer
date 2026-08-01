import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, ShoppingBag, Star, TrendingUp, Wallet } from "lucide-react";
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

import { ApiError } from "@/shared/api";
import { sellerPendingOrders } from "@/shared/api/endpoints/orders";
import { sellerRevenue } from "@/shared/api/endpoints/seller-analytics";
import { getSeller } from "@/shared/api/endpoints/sellers";
import { sellerProfile } from "@/shared/api/endpoints/users";
import { formatPrice } from "@/shared/lib";

import { toRevenueChartData } from "../model/dashboard-view";

interface KpiCardProps {
  icon: typeof Wallet;
  label: string;
  value: string;
}

function KpiCard({ icon: Icon, label, value }: KpiCardProps) {
  return (
    <div className="bg-card border border-border rounded-[var(--radius-lg)] p-5 flex flex-col">
      <div className="w-10 h-10 bg-primary-light rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
        <Icon size={20} className="text-primary" aria-hidden="true" />
      </div>
      <p className="text-2xl font-bold text-foreground mt-3">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
    </div>
  );
}

export function SellerDashboardRoute() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Seller profile for product count + rating
  const profileQuery = useQuery({
    queryKey: ["seller", "profile"],
    queryFn: sellerProfile,
    retry: false,
  });

  const sellerId = profileQuery.data?.id;
  const revenueQuery = useQuery({
    queryKey: ["seller", "revenue", { days: 30 }],
    queryFn: () => sellerRevenue({ days: 30 }),
    enabled: profileQuery.isSuccess,
    staleTime: 60_000,
    retry: false,
  });
  const chartData = useMemo(() => toRevenueChartData(revenueQuery.data ?? []), [revenueQuery.data]);
  const hasRevenue = chartData.length > 0;

  const retryRevenue = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["seller", "revenue", { days: 30 }] }),
    [queryClient],
  );

  const publicStatsQuery = useQuery({
    queryKey: ["seller", "public-stats", sellerId],
    queryFn: () => {
      if (!sellerId) throw new Error("A seller ID is required for public statistics");
      return getSeller(sellerId);
    },
    enabled: Boolean(sellerId),
    retry: false,
  });

  // Pending orders count
  const pendingQuery = useQuery({
    queryKey: ["seller", "pending-orders"],
    queryFn: () => sellerPendingOrders(),
    refetchInterval: 60_000,
    retry: false,
  });

  // Wallet balance
  const walletQuery = useQuery({
    queryKey: ["seller", "wallet"],
    queryFn: async () => {
      // WalletPage will do the full wallet + payouts query; we just need balance for KPI
      const { myWallet } = await import("@/shared/api/endpoints/seller-finance");
      return myWallet();
    },
    retry: false,
  });

  const statsLoading = profileQuery.isLoading || publicStatsQuery.isLoading;
  const walletBalance = walletQuery.data?.balance ?? null;
  const revenueLoading = revenueQuery.isLoading;
  const revenueError = revenueQuery.error;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {t("seller.dashboard.eyebrow")}
        </p>
        <h1 className="text-2xl font-bold text-foreground">{t("seller.dashboard.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("seller.dashboard.subtitle")}</p>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Wallet}
          label={t("seller.dashboard.kpi.balance")}
          value={walletBalance !== null ? formatPrice(walletBalance) : "—"}
        />
        <KpiCard
          icon={ShoppingBag}
          label={t("seller.dashboard.kpi.pending")}
          value={String(pendingQuery.data?.length ?? 0)}
        />
        <KpiCard
          icon={Package}
          label={t("seller.dashboard.kpi.products")}
          value={statsLoading ? "..." : String(publicStatsQuery.data?.totalProducts ?? 0)}
        />
        <KpiCard
          icon={Star}
          label={t("seller.dashboard.kpi.rating")}
          value={
            statsLoading
              ? "..."
              : publicStatsQuery.data?.ratingAvg == null
                ? t("seller.dashboard.kpi.noRating")
                : publicStatsQuery.data.ratingAvg.toFixed(1)
          }
        />
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-[var(--radius-lg)] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" aria-hidden="true" />
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
                  tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}tr`}
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
