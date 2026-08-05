import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatPrice } from "@/shared/lib";

import type { AdminDashboardView } from "../model/dashboard-view";

interface RevenueChartProps {
  points: AdminDashboardView["revenue"];
}

export function RevenueChart({ points }: RevenueChartProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.revenueTitle")}</h3>
      {points.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">
          {t("admin.dashboard.revenueEmpty")}
        </p>
      ) : (
        <div data-testid="admin-revenue-chart">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={[...points]}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
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
                  borderRadius: "12px",
                  border: "none",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
                }}
              />
              <Area
                type="monotone"
                dataKey="paidGmvVnd"
                color="var(--primary)"
                strokeWidth={2.5}
                fill="url(#revGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
