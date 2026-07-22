import {
  IconBan,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ConfirmDialog } from "../../components/ui/confirm-dialog";
import { ApiError } from "../../lib/api";
import {
  adminCancelOrder,
  adminChangeOrderStatus,
  adminListOrders,
  adminRefundOrder,
} from "../../lib/api/endpoints/admin";
import type { AdminOrderSummary } from "../../types/api";

const STATUS_OPTIONS = [
  { value: "", labelKey: "seller.orders.tabs.all" },
  { value: "PENDING_ACCEPTANCE", labelKey: "seller.orders.tabs.pending" },
  { value: "ACCEPTED", labelKey: "seller.orders.tabs.accepted" },
  { value: "PACKED", labelKey: "seller.orders.tabs.packed" },
  { value: "SHIPPED", labelKey: "seller.orders.tabs.shipped" },
  { value: "CANCELLED", labelKey: "seller.orders.tabs.cancelled" },
];

/** Maps raw BE status strings to human-readable i18n keys (P3-5). */
const STATUS_LABEL_KEY: Record<string, string> = {
  PENDING_ACCEPTANCE: "seller.orders.tabs.pending",
  ACCEPTED: "seller.orders.tabs.accepted",
  PACKED: "seller.orders.tabs.packed",
  SHIPPED: "seller.orders.tabs.shipped",
  DELIVERED: "orders.status.delivered",
  CANCELLED: "seller.orders.tabs.cancelled",
  REJECTED: "seller.orders.tabs.cancelled",
};

function statusColor(status: string): string {
  switch (status) {
    case "PENDING_ACCEPTANCE":
      return "bg-yellow-100 text-yellow-700";
    case "ACCEPTED":
    case "PACKED":
      return "bg-blue-100 text-blue-700";
    case "SHIPPED":
      return "bg-indigo-100 text-indigo-700";
    case "CANCELLED":
    case "REJECTED":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function OrderManagement() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const defaultRefundReason = t("admin.orders.refundDefaultReason", {
    defaultValue: "Admin approved refund",
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [page, setPage] = useState(0);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);

  const {
    data: orderPage,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin", "orders", statusFilter, appliedQuery, page],
    queryFn: () =>
      adminListOrders({
        status: statusFilter || undefined,
        q: appliedQuery || undefined,
        page,
        size: 50,
      }),
    retry: false,
  });

  const orders = orderPage?.content ?? [];
  const totalPages = orderPage?.totalPages ?? 0;

  const cancel = useMutation({
    mutationFn: (id: string) => adminCancelOrder(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(t("admin.orders.cancelOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.orders.cancelErr")),
  });

  const refund = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => adminRefundOrder(id, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(t("admin.orders.refundOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.orders.refundErr")),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminChangeOrderStatus(id, status),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(t("admin.orders.statusOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.orders.statusErr")),
  });

  const isMutating = cancel.isPending || refund.isPending || changeStatus.isPending;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-foreground">{t("admin.orders.title")}</h2>

      <div className="bg-card rounded-2xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatusFilter(opt.value);
                setPage(0);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={
                statusFilter === opt.value
                  ? { background: "var(--admin-primary)", color: "white" }
                  : {
                      background: "white",
                      color: "var(--admin-muted)",
                      border: "1px solid var(--admin-border)",
                    }
              }
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedQuery(query.trim());
            setPage(0);
          }}
        >
          <label htmlFor="admin-order-search" className="sr-only">
            {t("admin.orders.search")}
          </label>
          <input
            id="admin-order-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("admin.orders.searchPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--admin-primary)" }}
          >
            <IconSearch size={15} aria-hidden="true" />
            {t("admin.orders.search")}
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.orders.loading")}</p>
        </div>
      ) : isError ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-red-600">
            {t("admin.orders.loadErr", {
              message: error instanceof Error ? error.message : "unknown error",
            })}
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.orders.empty")}</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {orders.map((o: AdminOrderSummary) => (
              <div key={o.orderId} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* P2-10: title attr for hover-tooltip on truncated id */}
                  <p className="text-sm font-semibold text-foreground truncate" title={o.orderId}>
                    {o.orderNumber ?? o.orderId}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("admin.orders.buyer")}: {o.buyerName ?? o.buyerId ?? "—"} ·{" "}
                    {o.totalAmount?.toLocaleString("vi-VN") ?? "—"} ₫ · {o.itemCount ?? 0}{" "}
                    {t("admin.orders.items")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.orders.seller")}: {o.sellerName ?? o.sellerId ?? "-"}
                  </p>
                  {o.createdAt ? (
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* P3-5: translated status badge */}
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor(o.status)}`}
                  >
                    {t(STATUS_LABEL_KEY[o.status] ?? "admin.orders.status.unknown", {
                      defaultValue: o.status,
                    })}
                  </span>
                  {/* P1-10: WCAG 2.5.5 minimum target size — p-2.5 ≈ 40px */}
                  <button
                    onClick={() => {
                      setRefundOrderId(o.orderId);
                      setRefundDialogOpen(true);
                    }}
                    disabled={isMutating}
                    title={t("admin.orders.refund")}
                    aria-label={t("admin.orders.refund")}
                    className="p-2.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <IconRefresh size={14} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => cancel.mutate(o.orderId)}
                    disabled={isMutating}
                    title={t("admin.orders.cancel")}
                    aria-label={t("admin.orders.cancel")}
                    className="p-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <IconBan size={14} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => changeStatus.mutate({ id: o.orderId, status: "ACCEPTED" })}
                    disabled={isMutating}
                    title={t("admin.orders.accept")}
                    aria-label={t("admin.orders.accept")}
                    className="p-2.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <IconCheck size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(current - 1, 0))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
              >
                <IconChevronLeft size={14} aria-hidden="true" /> {t("admin.orders.previous")}
              </button>
              <span>{t("admin.orders.page", { page: page + 1, pages: totalPages })}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(current + 1, totalPages - 1))}
                disabled={page + 1 >= totalPages}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
              >
                {t("admin.orders.next")} <IconChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={refundDialogOpen}
        onClose={() => {
          setRefundDialogOpen(false);
          setRefundOrderId(null);
        }}
        onConfirm={(_reason) => {
          if (refundOrderId) {
            refund.mutate({ id: refundOrderId, reason: _reason?.trim() || defaultRefundReason });
          }
        }}
        variant="danger"
        reasonField
        title={t("admin.orders.refundConfirmTitle")}
        description={t("admin.orders.refundConfirmDescription")}
        confirmLabel={t("admin.orders.refundConfirmBtn")}
        cancelLabel={t("common.cancel")}
      />
    </div>
  );
}
