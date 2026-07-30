import { IconWalletOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import { formatDate, formatPrice, groupByDate } from "@/shared/lib";
import { StatusPill } from "@/shared/ui";

import type { WalletHistoryItem } from "../model/wallet-view";

type PayoutFilter = "all" | "active" | "paid" | "failed";

const FILTER_STATUS_MAP: Record<Exclude<PayoutFilter, "all">, Set<string>> = {
  paid: new Set(["PAID"]),
  active: new Set(["REQUESTED", "APPROVED", "SUBMITTING", "SUBMITTED", "UNKNOWN"]),
  failed: new Set(["FAILED", "REJECTED", "CANCELLED", "REVERSED"]),
};

interface PayoutHistoryProps {
  history: readonly WalletHistoryItem[];
  filter: PayoutFilter;
  onFilterChange: (filter: PayoutFilter) => void;
}

export function PayoutHistory({ history, filter, onFilterChange }: PayoutHistoryProps) {
  const { t, i18n } = useTranslation();

  const filterOptions: PayoutFilter[] = ["all", "paid", "active", "failed"];

  const filtered = (() => {
    const matchSet = FILTER_STATUS_MAP[filter as Exclude<PayoutFilter, "all">];
    if (!matchSet) return history;
    return history.filter((item) => {
      const upper = item.status.toUpperCase();
      return [...matchSet].some((s) => upper.includes(s));
    });
  })();

  const sections = groupByDate(
    filtered,
    (item) => item.requestedAt,
    i18n.language,
  );

  return (
    <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border">
        <h3 className="font-bold text-foreground">{t("seller.wallet.historyTitle")}</h3>
        <div className="flex items-center gap-1.5">
          {filterOptions.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
              style={{
                background:
                  filter === f ? "rgb(var(--primary-light-rgb) / 0.12)" : "transparent",
                color: filter === f ? "var(--primary)" : "var(--muted-foreground)",
                border: filter === f ? "1px solid var(--primary)" : "1px solid transparent",
              }}
            >
              {t(`seller.wallet.historyFilter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 text-center">
          <IconWalletOff size={40} className="mx-auto mb-3 text-gray-200" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("seller.wallet.historyEmpty")}</p>
        </div>
      ) : null}

      <ul className="divide-y divide-gray-50">
        {sections.map((section) => (
          <li key={section.key}>
            <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground bg-muted/40">
              {t(section.labelKey, section.labelArgs)}
            </div>
            {section.items.map((item) => (
              <li
                key={item.id}
                className="px-5 py-4 flex items-center justify-between border-t border-gray-50 first:border-t-0"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPrice(item.amountVnd)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.requestedAt
                      ? formatDate(item.requestedAt)
                      : t("common.unavailable")}
                  </p>
                </div>
                <StatusPill status={item.status} />
              </li>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
