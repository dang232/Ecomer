import { AlertCircle, BarChart3, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ApiError } from "@/shared/api";
import { formatPrice } from "@/shared/lib";
import { Surface } from "@/shared/ui";

import type { DashboardRevenuePoint } from "../model/dashboard-view";

interface RevenueChartProps {
  points: readonly DashboardRevenuePoint[];
  days: number;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}

function compactRevenue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

function formatChartDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(date);
}

export function RevenueChart({ points, days, isLoading, error, onRetry }: RevenueChartProps) {
  const { t, i18n } = useTranslation();
  const chartData = points.map((point) => ({
    ...point,
    dateLabel: formatChartDate(point.date, i18n.resolvedLanguage ?? "vi-VN"),
  }));

  return (
    <Surface padding="lg" className="min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-primary" aria-hidden="true" />
            <h2 className="text-base font-bold text-foreground">
              {t("seller.dashboard.revenueTitle", { days })}
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("seller.dashboard.revenueHint")}</p>
        </div>
        <div
          className="flex items-center gap-3 text-xs text-muted-foreground"
          aria-label={t("seller.dashboard.chartLegend")}
        >
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            {t("seller.dashboard.revenueLegend")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            {t("seller.dashboard.ordersLegend")}
          </span>
        </div>
      </div>

      {error ? (
        <div
          className="mt-6 flex items-start gap-3 border-l-4 border-error bg-error-light px-4 py-3 text-sm text-error"
          role="alert"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>
              {t("seller.dashboard.revenueError", {
                message: error instanceof ApiError ? error.message : "",
              })}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex min-h-[var(--target-web)] items-center gap-1.5 font-semibold underline underline-offset-2"
            >
              <RefreshCw size={14} aria-hidden="true" />
              {t("seller.dashboard.revenueRetry")}
            </button>
          </div>
        </div>
      ) : isLoading ? (
        <div
          className="mt-6 flex h-[280px] items-center justify-center rounded-[var(--radius-md)] bg-muted text-sm text-muted-foreground"
          role="status"
        >
          {t("seller.dashboard.revenueLoading")}
        </div>
      ) : chartData.length > 0 ? (
        <div className="mt-5 h-[280px]" data-testid="seller-performance-chart">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                yAxisId="revenue"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                tickFormatter={(value: number) => compactRevenue(value)}
                width={42}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                labelFormatter={(label) =>
                  formatChartDate(String(label), i18n.resolvedLanguage ?? "vi-VN")
                }
                formatter={(value: number, name: string) =>
                  name === "revenueVnd"
                    ? [formatPrice(value), t("seller.dashboard.revenueLegend")]
                    : [String(value), t("seller.dashboard.ordersLegend")]
                }
                contentStyle={{
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Bar
                yAxisId="orders"
                dataKey="orders"
                fill="var(--accent)"
                barSize={8}
                radius={[4, 4, 0, 0]}
              />
              <Area
                yAxisId="revenue"
                type="monotone"
                dataKey="revenueVnd"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="var(--primary)"
                fillOpacity={0.14}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="mt-6 flex h-[280px] items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          {t("seller.dashboard.revenueEmpty")}
        </div>
      )}
    </Surface>
  );
}
