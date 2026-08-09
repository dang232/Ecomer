import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  ADMIN_QUEUE_CAPABILITIES,
  AdminQueueFrame,
  useAdminCursorPagination,
} from "@/features/admin";
import { ApiError, isCursorResetError } from "@/shared/api";
import {
  adminCancelOrder,
  adminRefundOrder,
  adminChangeOrderStatus,
} from "@/shared/api/endpoints/admin";
import type { DataTableColumn } from "@/shared/ui/data-table";

import { adminOrdersCursorQueryOptions } from "../api/query-options";
import type { OrderView } from "../model/order-view";
import { toOrderView } from "../model/order-view";

import { OrderDecisionDialog } from "./order-decision-dialog";

interface OrderQueueProps {
  q: string;
  status: string;
  selected: string | null;
  onSearch: (q: string) => void;
  onStatusChange: (status: string) => void;
  onSelect: (id: string | null) => void;
}

type DialogVariant = "cancel" | "refund" | "change-status";

type DialogSetter = (
  next: { variant: DialogVariant; orderId: string; orderNumber?: string | null } | null,
) => void;

export function AdminOrderQueue({
  q,
  status,
  selected,
  onSearch,
  onStatusChange,
  onSelect,
}: OrderQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const defaultRefundReason = t("admin.orders.refundDefaultReason", {
    defaultValue: "Admin approved refund",
  });
  const cursorPagination = useAdminCursorPagination({
    scopeKey: `${q}\u0000${status}`,
  });

  // URL-owned state
  const [dialog, setDialog] = useState<{
    variant: DialogVariant;
    orderId: string;
    orderNumber?: string | null;
  } | null>(null);

  const {
    data: pageData,
    isLoading,
    isError,
    isFetching,
    error,
  } = useQuery({
    ...adminOrdersCursorQueryOptions({
      q,
      status,
      cursor: cursorPagination.cursor,
      limit: cursorPagination.pageSize,
    }),
  });

  const orders = (pageData?.items ?? []).map(toOrderView);

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
    mutationFn: ({ id, status: newStatus }: { id: string; status: string }) =>
      adminChangeOrderStatus(id, newStatus),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      toast.success(t("admin.orders.statusOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.orders.statusErr")),
  });

  const isMutating = cancel.isPending || refund.isPending || changeStatus.isPending;

  const columns = buildOrderQueueColumns({
    t,
    isMutating,
    setDialog,
  });

  const selectedOrder = selected ? (orders.find((o) => o.id === selected) ?? null) : null;

  return (
    <>
      <AdminQueueFrame
        title={t("admin.orders.title") ?? "Order Queue"}
        capabilities={ADMIN_QUEUE_CAPABILITIES.orders}
        q={q}
        status={status}
        sort=""
        onSearch={onSearch}
        onStatusChange={onStatusChange}
        onSortChange={() => undefined}
        selectedId={selected}
        onSelect={onSelect}
        rows={orders}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        pagination={undefined}
        onPageChange={() => undefined}
        cursorPagination={{
          itemCount: orders.length,
          pageIndex: cursorPagination.pageIndex,
          pageSize: cursorPagination.pageSize,
          hasPrevious: cursorPagination.hasPrevious,
          hasMore: pageData?.hasMore ?? false,
          isFetching,
          onPrevious: cursorPagination.goBack,
          onNext: () => cursorPagination.advance(pageData?.nextCursor ?? null),
          onRefresh: () => void qc.invalidateQueries({ queryKey: ["admin", "orders", "cursor"] }),
          onPageSizeChange: cursorPagination.setPageSize,
        }}
        cursorError={isCursorResetError(error)}
        onResetCursor={cursorPagination.reset}
        drawerTitle={selectedOrder ? (selectedOrder.orderNumber ?? selectedOrder.id) : ""}
        drawerDescription={selectedOrder?.buyerName ?? undefined}
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("admin.orders.buyer")}</p>
                <p className="font-semibold">{selectedOrder.buyerName ?? selectedOrder.buyerId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("admin.orders.seller")}</p>
                <p className="font-semibold">
                  {selectedOrder.sellerName ?? selectedOrder.sellerId ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("admin.orders.total")}</p>
                <p className="font-semibold">
                  {selectedOrder.totalAmount.toLocaleString("vi-VN")} ₫
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("admin.orders.items")}</p>
                <p className="font-semibold">{selectedOrder.itemCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("admin.orders.status")}</p>
                <StatusChip status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-muted-foreground">{t("admin.orders.date")}</p>
                <p className="font-semibold">
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString("vi-VN")
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </AdminQueueFrame>

      {dialog ? (
        <OrderDecisionDialog
          variant={dialog.variant}
          orderId={dialog.orderId}
          orderNumber={dialog.orderNumber}
          isPending={isMutating}
          onConfirm={() => {
            if (dialog.variant === "cancel") {
              cancel.mutate(dialog.orderId);
            } else if (dialog.variant === "refund") {
              const reasonField = document.getElementById(
                "refund-reason",
              ) as HTMLTextAreaElement | null;
              const reason = reasonField?.value.trim() || defaultRefundReason;
              refund.mutate({ id: dialog.orderId, reason });
            } else if (dialog.variant === "change-status") {
              const statusField = document.getElementById(
                "order-status",
              ) as HTMLSelectElement | null;
              const newStatus = statusField?.value;
              if (newStatus) {
                changeStatus.mutate({ id: dialog.orderId, status: newStatus });
              }
            }
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}

interface OrderQueueColumnProps {
  t: TFunction;
  isMutating: boolean;
  setDialog: DialogSetter;
}

function buildOrderQueueColumns({
  t,
  isMutating,
  setDialog,
}: OrderQueueColumnProps): DataTableColumn<OrderView>[] {
  return [
    {
      id: "orderNumber",
      header: t("admin.orders.th.orderNumber") ?? "Order #",
      cell: (row) => <OrderNumberCell order={row} />,
    },
    {
      id: "buyerName",
      header: t("admin.orders.buyer") ?? "Buyer",
      cell: (row) => row.buyerName ?? row.buyerId ?? "—",
    },
    {
      id: "sellerName",
      header: t("admin.orders.seller") ?? "Seller",
      cell: (row) => row.sellerName ?? row.sellerId ?? "—",
    },
    {
      id: "itemCount",
      header: t("admin.orders.items") ?? "Items",
      cell: (row) => row.itemCount,
    },
    {
      id: "totalAmount",
      header: t("admin.orders.total") ?? "Total",
      cell: (row) => (row.totalAmount ? `${row.totalAmount.toLocaleString("vi-VN")} ₫` : "—"),
    },
    {
      id: "status",
      header: t("admin.orders.status") ?? "Status",
      cell: (row) => <StatusChip status={row.status} />,
    },
    {
      id: "createdAt",
      header: t("admin.orders.date") ?? "Date",
      cell: (row) => (row.createdAt ? new Date(row.createdAt).toLocaleDateString("vi-VN") : "—"),
    },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <OrderActionsCell order={row} isMutating={isMutating} t={t} setDialog={setDialog} />
      ),
    },
  ];
}

function OrderNumberCell({ order }: { order: OrderView }) {
  return <span className="font-mono text-sm font-semibold">{order.orderNumber ?? order.id}</span>;
}

function OrderActionsCell({
  order,
  isMutating,
  t,
  setDialog,
}: {
  order: OrderView;
  isMutating: boolean;
  t: TFunction;
  setDialog: DialogSetter;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() =>
          setDialog({
            variant: "refund",
            orderId: order.id,
            orderNumber: order.orderNumber,
          })
        }
        disabled={isMutating}
        title={t("admin.orders.refund")}
        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {t("admin.orders.refund")}
      </button>
      <button
        onClick={() =>
          setDialog({
            variant: "change-status",
            orderId: order.id,
            orderNumber: order.orderNumber,
          })
        }
        disabled={isMutating}
        title={t("admin.orders.changeStatus")}
        className="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {t("admin.orders.changeStatus") ?? "Status"}
      </button>
      <button
        onClick={() =>
          setDialog({
            variant: "cancel",
            orderId: order.id,
            orderNumber: order.orderNumber,
          })
        }
        disabled={isMutating}
        title={t("admin.orders.cancel")}
        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
      >
        {t("admin.orders.cancel")}
      </button>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    PENDING_ACCEPTANCE: "bg-yellow-100 text-yellow-700",
    ACCEPTED: "bg-blue-100 text-blue-700",
    PACKED: "bg-blue-100 text-blue-700",
    SHIPPED: "bg-indigo-100 text-indigo-700",
    CANCELLED: "bg-red-100 text-red-600",
    DELIVERED: "bg-green-100 text-green-700",
  };
  const cls = colorMap[status] ?? "bg-gray-100 text-gray-600";
  return <span className={`rounded px-2 py-0.5 text-xs font-bold ${cls}`}>{status}</span>;
}
