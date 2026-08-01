import { Package, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { StatusPill } from "@/shared/ui";

import type { SellerOrderRow } from "../model/order-queue-view";

interface OrderDetailDrawerProps {
  row: SellerOrderRow | null;
  onClose: () => void;
}

export function OrderDetailDrawer({ row, onClose }: OrderDetailDrawerProps) {
  const { t } = useTranslation();

  if (!row) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />

      {/* Drawer */}
      <div
        className="relative ml-auto w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={t("seller.orders.detailDrawer.title", { id: row.id })}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {t("seller.orders.detailDrawer.title", { id: row.id })}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("seller.orders.detailDrawer.parentOrder", { id: row.orderId })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-background transition-colors"
            aria-label={t("seller.orders.detailDrawer.close")}
          >
            <X size={18} className="text-muted-foreground" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <StatusPill status={row.status} />
            <span className="text-xs text-muted-foreground">
              {new Date(row.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Items summary */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.detailDrawer.items", { count: row.itemCount })}
            </p>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Package size={14} className="text-muted-foreground" aria-hidden="true" />
              {row.itemSummary}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
