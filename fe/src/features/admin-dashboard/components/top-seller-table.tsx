import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";

import type { AdminDashboardView } from "../model/dashboard-view";

interface TopSellerTableProps {
  rows: AdminDashboardView["topSellers"];
}

export function TopSellerTable({ rows }: TopSellerTableProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm">
      <h3 className="font-bold text-foreground mb-4">{t("admin.dashboard.topSellers")}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          {t("admin.dashboard.noData")}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3">
              <span
                className="w-6 text-center text-sm font-black"
                style={{ color: i < 3 ? "var(--accent)" : "var(--muted-foreground)" }}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {s.name ?? t("admin.dashboard.unknownShop")}
                </p>
              </div>
              <span className="font-bold text-sm shrink-0" style={{ color: "var(--accent)" }}>
                {formatPrice(s.paidGmvVnd)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
