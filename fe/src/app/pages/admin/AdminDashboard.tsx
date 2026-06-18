import { IconAlertCircle, IconChartBar, IconPackage, IconRefresh, IconTrendingUp, IconUsers, IconWallet } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
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

import { KPICard } from "../../components/kpi-card";
import { ApiError } from "../../lib/api";
import {
  dashboardRevenue,
  dashboardSummary,
  dashboardTopProducts,
  dashboardTopSellers,
} from "../../lib/api/endpoints/admin";
import { formatPrice } from "../../lib/format";
import { comingSoon } from "../../lib/ui/coming-soon";


export function AdminDashboard() {
  const { t } = useTranslation();
  const summaryQuery = useQuery({
    queryKey: ["admin", "dashboard", "summary"],
    queryFn: dashboardSummary,
    retry: false,
  });
  const revenueQuery = useQuery({
    queryKey: ["admin", "dashboard", "revenue"],
    queryFn: () => dashboardRevenue({ granularity: "month" }),
    retry: false,
  });
  const topProductsQuery = useQuery({
    queryKey: ["admin", "dashboard", "top-products"],
    queryFn: () => dashboardTopProducts({ limit: 5 }),
    retry: false,
  });
  const topSellersQuery = useQuery({
    queryKey: ["admin", "dashboard", "top-sellers"],
    queryFn: () => dashboardTopSellers({ limit: 5 }),
    retry: false,
  });

  const totalRevenue = summaryQuery.data?.totalRevenue ?? null;
  const totalUsers = summaryQuery.data?.totalUsers ?? null;
  const totalOrders = summaryQuery.data?.totalOrders ?? null;
  const totalSellers = summaryQuery.data?.totalSellers ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("admin.dashboard.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p>
        </div>
        <button
          onClick={() => comingSoon("Export", t)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <IconChartBar size={15} /> {t("admin.dashboard.exportReport")}
        </button>
      </div>

      {summaryQuery.error instanceof ApiError ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-3">
          <IconAlertCircle size={18} className="shrink-0 text-amber-500" />
          <p className="flex-1">
            {t("admin.dashboard.kpiLoadFailFriendly", {
              defaultValue: "Unable to load metrics. Please check your permissions or try again.",
            })}
          </p>
          <button
            type="button"
            onClick={() => summaryQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
          >
            <IconRefresh size={14} />
            {t("common.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={IconTrendingUp}
          label={t("admin.dashboard.kpi.totalRevenue")}
          value={totalRevenue !== null ? formatPrice(totalRevenue) : "—"}
          color="var(--primary)"
        />
        <KPICard
          icon={IconUsers}
          label={t("admin.dashboard.kpi.totalUsers")}
          value={totalUsers !== null ? totalUsers.toLocaleString() : "—"}
          color="var(--info)"
        />
        <KPICard
          icon={IconPackage}
          label={t("admin.dashboard.kpi.totalOrders")}
          value={totalOrders !== null ? totalOrders.toLocaleString() : "—"}
          color="var(--accent)"
        />
        <KPICard
          icon={IconWallet}
          label={t("admin.dashboard.kpi.totalSellers")}
          value={totalSellers !== null ? totalSellers.toLocaleString() : "—"}
          color="var(--warning)"
        />
      </div>

      <div className="bg-card rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.revenueTitle")}</h3>
        {revenueQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("admin.dashboard.loading")}</p>
        ) : null}
        {revenueQuery.data && revenueQuery.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={revenueQuery.data}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`}
              />
              <Tooltip
                formatter={(v: number) => formatPrice(v)}
                contentStyle={{
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="amount"
                color="var(--primary)"
                strokeWidth={2.5}
                fill="url(#revGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          !revenueQuery.isLoading && (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t("admin.dashboard.revenueEmpty")}
            </p>
          )
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.topProducts")}</h3>
          {topProductsQuery.data && topProductsQuery.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topProductsQuery.data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}tr`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  width={120}
                />
                <Tooltip formatter={(v: number) => formatPrice(v)} />
                <Bar dataKey="revenue" fill="var(--accent)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("admin.dashboard.noData")}</p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.topSellers")}</h3>
          {topSellersQuery.data && topSellersQuery.data.length > 0 ? (
            <div className="space-y-3">
              {topSellersQuery.data.map((s, i) => (
                <div key={s.sellerId} className="flex items-center gap-3">
                  <span
                    className="w-6 text-center text-sm font-black"
                    style={{ color: i < 3 ? "var(--accent)" : "var(--muted-foreground)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.shopName ?? s.sellerId}
                    </p>
                  </div>
                  <span className="font-bold text-sm shrink-0" style={{ color: "var(--accent)" }}>
                    {formatPrice(s.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">{t("admin.dashboard.noData")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
