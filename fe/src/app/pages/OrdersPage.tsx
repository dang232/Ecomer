import { useSuspenseQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useAuth } from "../hooks/auth-context";
import { useCart } from "../hooks/use-cart";
import { myOrdersOptions, useCancelOrder } from "../hooks/use-orders";
import { ApiError } from "@/shared/api";
import { ConfirmDialog, PageContainer, PageHeader } from "@/shared/ui";
import { OrderList, toOrderView, type OrderView } from "@/features/orders";

type OrderTab = "all" | "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";

export function OrdersPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login } = useAuth();
  const { addItemAsync } = useCart();
  const cancelOrder = useCancelOrder();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const [page, setPage] = useState(0);
  const [orderToCancel, setOrderToCancel] = useState<OrderView | null>(null);
  const ordersQuery = useSuspenseQuery(myOrdersOptions({ page, size: 20 }));

  const allOrders = useMemo(
    () =>
      (ordersQuery.data?.content ?? []).map((order) =>
        toOrderView({
          detail: order,
          summary: order,
        }),
      ),
    [ordersQuery.data?.content],
  );

  const filteredOrders = useMemo(
    () => (activeTab === "all" ? allOrders : allOrders.filter((order) => order.status === activeTab)),
    [activeTab, allOrders],
  );

  const tabs = useMemo(
    () => [
      { id: "all" as const, labelKey: "orders.tabs.all" },
      { id: "pending" as const, labelKey: "orders.tabs.pending" },
      { id: "shipping" as const, labelKey: "orders.tabs.shipping" },
      { id: "delivered" as const, labelKey: "orders.tabs.delivered" },
      { id: "cancelled" as const, labelKey: "orders.tabs.cancelled" },
    ],
    [],
  );

  const handleBuyAgain = useCallback(
    async (order: OrderView) => {
      const lines = order.sellerGroups.flatMap((group) => group.items);
      if (lines.length === 0) {
        toast.info(t("orders.reorder.noItems"));
        return;
      }

      try {
        for (const item of lines) {
          await addItemAsync({ productId: item.productId, quantity: item.quantity });
        }
        toast.success(t("orders.reorder.added", { count: lines.length }));
      } catch (error) {
        toast.error(error instanceof ApiError ? error.message : t("orders.reorder.addError"));
      }
    },
    [addItemAsync, t],
  );

  if (!ready) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center text-sm text-muted-foreground">
        {t("orders.initSession")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Package size={64} className="mx-auto mb-6 text-muted-foreground/30" />
        <h2 className="text-xl font-bold text-foreground">{t("orders.loginPromptTitle")}</h2>
        <button
          type="button"
          onClick={() => login("/orders")}
          className="mt-4 rounded-[var(--radius-md)] bg-primary px-6 py-3 font-semibold text-white"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  return (
    <PageContainer className="pb-8">
      <PageHeader
        title={t("orders.pageTitle")}
        description={t("orders.listDescription")}
        className="mb-6"
      />

      <div role="tablist" aria-label={t("orders.tabLabel")} className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`orders-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                active ? "bg-primary text-white" : "bg-card text-muted-foreground"
              }`}
            >
              {t(tab.labelKey)}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`orders-tab-${activeTab}`}>
        <OrderList
          orders={filteredOrders}
          onCancel={setOrderToCancel}
          onBuyAgain={(order) => void handleBuyAgain(order)}
        />
      </div>

      {(ordersQuery.data?.totalPages ?? 0) > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={ordersQuery.data?.first ?? true}
            className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {t("common.prev")}
          </button>
          <span aria-current="page" className="text-sm text-muted-foreground">
            {(ordersQuery.data?.page ?? page) + 1} / {ordersQuery.data?.totalPages ?? 1}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={ordersQuery.data?.last ?? true}
            className="rounded-[var(--radius-md)] border border-border px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {t("common.next")}
          </button>
        </nav>
      ) : null}

      <ConfirmDialog
        open={orderToCancel !== null}
        onClose={() => setOrderToCancel(null)}
        onConfirm={() => {
          if (!orderToCancel) return;
          cancelOrder.mutate(orderToCancel.id, {
            onSuccess: () => toast.success(t("orders.cancelOk")),
            onError: (error) =>
              toast.error(error instanceof ApiError ? error.message : t("orders.cancelErr")),
          });
        }}
        title={t("orders.cancelDialog.title", {
          id: orderToCancel ? orderToCancel.id.slice(0, 8).toUpperCase() : "",
          defaultValue: "Cancel order #{{id}}?",
        })}
        description={t("orders.cancelDialog.description", {
          defaultValue: "This will cancel your order. You won't be able to undo this.",
        })}
        confirmLabel={t("orders.actions.cancel")}
        cancelLabel={t("common.cancel")}
        variant="danger"
      />
    </PageContainer>
  );
}

export default OrdersPage;
