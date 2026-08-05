import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { AdminDashboardView } from "../model/dashboard-view";

interface TopProductsChartProps {
  products: AdminDashboardView["topProducts"];
}

export function TopProductsChart({ products }: TopProductsChartProps) {
  const { t, i18n } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(i18n.resolvedLanguage ?? "vi-VN");

  return (
    <section className="min-w-0 rounded-[var(--radius-md)] bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-base font-bold text-foreground">
        {t("admin.dashboard.topProducts")}
      </h2>
      {products.length === 0 ? (
        <p
          className="flex h-[260px] items-center justify-center text-center text-sm text-muted-foreground"
          data-testid="admin-top-products-empty"
        >
          {t("admin.dashboard.noData")}
        </p>
      ) : (
        <div
          className="h-[260px]"
          data-testid="admin-top-products-chart"
          aria-label={t("admin.dashboard.topProducts")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...products]} margin={{ top: 8, right: 12, bottom: 42, left: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-28}
                textAnchor="end"
                height={56}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={36}
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number) => [
                  numberFormatter.format(value),
                  t("admin.dashboard.units"),
                ]}
                contentStyle={{
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow-lg)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
              />
              <Bar
                dataKey="unitsSold"
                fill="var(--accent)"
                radius={[4, 4, 0, 0]}
                maxBarSize={44}
                name={t("admin.dashboard.units")}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
