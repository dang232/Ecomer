import {
  IconAlertCircle,
  IconChartBar,
  IconPackage,
  IconTrendingUp,
  IconUsers,
  IconWallet,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
import { dashboardReport, dashboardExport } from "../../lib/api/endpoints/admin";
import { formatPrice } from "../../lib/format";

export function AdminDashboard() {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const periodEnd = new Date().toISOString().slice(0, 10);
  const periodStart = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dashboardParams = {
    from: periodStart,
    to: periodEnd,
    granularity: "day" as const,
    limit: 5,
  };
  const reportQuery = useQuery({
    queryKey: ["admin", "dashboard", "report", periodStart, periodEnd],
    queryFn: () => dashboardReport(dashboardParams),
    retry: false,
  });

  const summary = reportQuery.data?.summary;
  const paidGmv = summary?.paidGmv ?? null;
  const refundedAmount = summary?.refundedAmount ?? null;
  const realizedRevenue = summary?.realizedRevenue ?? null;
  const activeBuyers = summary?.activeBuyers ?? null;
  const totalOrders = summary?.totalOrders ?? null;
  const activeSellers = summary?.activeSellers ?? null;
  const revenue = reportQuery.data?.revenue.points ?? [];
  const topProducts = reportQuery.data?.topProducts ?? [];
  const topSellers = reportQuery.data?.topSellers ?? [];

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(false);
    try {
      const blob = await dashboardExport({ ...dashboardParams, asOf: reportQuery.data?.asOf });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vnshop-dashboard-${periodStart}-to-${periodEnd}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("admin.dashboard.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.dashboard.subtitle")}</p>
        </div>
        <button
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <IconChartBar size={15} />{" "}
          {isExporting ? t("admin.dashboard.exporting") : t("admin.dashboard.exportReport")}
        </button>
      </div>
      {exportError ? (
        <p role="alert" className="text-sm text-amber-700">
          {t("admin.dashboard.exportFailed")}
        </p>
      ) : null}

      {reportQuery.isError ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-3">
          <IconAlertCircle size={18} className="shrink-0 text-amber-500" />
          <p className="flex-1">
            {t("admin.dashboard.kpiLoadFailFriendly", {
              defaultValue: "Unable to load metrics. Please check your permissions or try again.",
            })}
          </p>
          <button
            type="button"
            onClick={() => reportQuery.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
          >
            {t("common.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          icon={IconTrendingUp}
          label={t("admin.dashboard.kpi.paidGmv")}
          value={paidGmv !== null ? formatPrice(paidGmv) : "N/A"}
          color="var(--primary)"
        />
        <KPICard
          icon={IconUsers}
          label={t("admin.dashboard.kpi.activeBuyers")}
          value={activeBuyers !== null ? activeBuyers.toLocaleString() : "N/A"}
          color="var(--info)"
        />
        <KPICard
          icon={IconTrendingUp}
          label={t("admin.dashboard.kpi.realizedRevenue")}
          value={realizedRevenue !== null ? formatPrice(realizedRevenue) : "N/A"}
          color="var(--success)"
        />
        <KPICard
          icon={IconChartBar}
          label={t("admin.dashboard.kpi.refundedAmount")}
          value={refundedAmount !== null ? formatPrice(refundedAmount) : "N/A"}
          color="var(--warning)"
        />
        <KPICard
          icon={IconPackage}
          label={t("admin.dashboard.kpi.paidOrders")}
          value={totalOrders !== null ? totalOrders.toLocaleString() : "N/A"}
          color="var(--accent)"
        />
        <KPICard
          icon={IconWallet}
          label={t("admin.dashboard.kpi.activeSellers")}
          value={activeSellers !== null ? activeSellers.toLocaleString() : "N/A"}
          color="var(--warning)"
        />
      </div>

      <div className="bg-card rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.revenueTitle")}</h3>
        {reportQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("admin.dashboard.loading")}</p>
        ) : null}
        {!reportQuery.isError && revenue.length > 0 ? (
          <div data-testid="admin-revenue-chart">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenue}>
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
                  dataKey="paidGmv"
                  color="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !reportQuery.isLoading &&
          !reportQuery.isError && (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t("admin.dashboard.revenueEmpty")}
            </p>
          )
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.topProducts")}</h3>
          {topProducts.length > 0 ? (
            <div data-testid="admin-top-products-chart">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                    tickFormatter={(v: number) => v.toLocaleString()}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    width={120}
                  />
                  <Tooltip
                    formatter={(v: number) => `${v.toLocaleString()} ${t("admin.dashboard.units")}`}
                  />
                  <Bar dataKey="unitsSold" fill="var(--accent)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("admin.dashboard.noData")}
            </p>
          )}
        </div>

        <div className="bg-card rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.topSellers")}</h3>
          {topSellers.length > 0 ? (
            <div className="space-y-3">
              {topSellers.map((s, i) => (
                <div key={s.sellerId} className="flex items-center gap-3">
                  <span
                    className="w-6 text-center text-sm font-black"
                    style={{ color: i < 3 ? "var(--accent)" : "var(--muted-foreground)" }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.shopName ?? t("admin.dashboard.unknownShop")}
                    </p>
                  </div>
                  <span className="font-bold text-sm shrink-0" style={{ color: "var(--accent)" }}>
                    {formatPrice(s.paidGmv)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t("admin.dashboard.noData")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
