import { MessageSquare, RotateCcw, ShoppingCart, XCircle } from "lucide-react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button, EmptyState } from "@/shared/ui";
import { formatPrice } from "@/shared/lib";

import type { OrderAction, OrderView } from "../model/order-view";

interface OrderListProps {
  orders: readonly OrderView[];
  onCancel: (order: OrderView) => void;
  onBuyAgain: (order: OrderView) => void;
}

function sellerLabel(order: OrderView): string {
  const group = order.sellerGroups[0];
  if (!group) return "seller-unavailable";
  return group.sellerName ?? group.sellerId;
}

function actionFor(
  order: OrderView,
  action: OrderAction,
  callbacks: Pick<OrderListProps, "onCancel" | "onBuyAgain">,
  t: TFunction,
) {
  const labelKey =
    action === "buy-again"
      ? "orders.actions.reorder"
      : action === "request-return"
        ? "orders.actions.return"
        : "orders.actions.cancel";

  switch (action) {
    case "cancel":
      return (
        <Button key={action} variant="outline" onClick={() => callbacks.onCancel(order)}>
          <XCircle size={16} />
          {t(labelKey)}
        </Button>
      );
    case "buy-again":
      return (
        <Button key={action} variant="outline" onClick={() => callbacks.onBuyAgain(order)}>
          <ShoppingCart size={16} />
          {t(labelKey)}
        </Button>
      );
    case "request-return": {
      const subOrderId = order.sellerGroups[0]?.subOrderId;
      const href = subOrderId
        ? `/returns/new?orderId=${encodeURIComponent(order.id)}&subOrderId=${encodeURIComponent(subOrderId)}`
        : "/returns/new";
      return (
        <Link
          key={action}
          to={href}
          className="inline-flex min-h-[var(--target-web)] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw size={16} />
          {t(labelKey)}
        </Link>
      );
    }
    default:
      return null;
  }
}

export function OrderList({ orders, onCancel, onBuyAgain }: OrderListProps) {
  const { t } = useTranslation();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart size={24} />}
        title={t("orders.empty")}
        description={t("orders.emptyHint")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <article key={order.id} className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">{order.orderNumber ?? order.id}</h2>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {t(`orders.status.${order.status}`)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("orders.sellerLabel", { seller: sellerLabel(order) })}
              </p>
              {order.placedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("orders.placedAt", { date: new Date(order.placedAt).toLocaleDateString() })}
                </p>
              ) : null}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-muted-foreground">{t("orders.totalLabel")}</p>
              <p className="text-lg font-bold text-foreground">
                {formatPrice(order.financial.totalVnd)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {order.sellerGroups.map((group) =>
              group.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-muted-foreground">
                      {t("orders.itemQuantity", { count: item.quantity })}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-foreground">{formatPrice(item.totalVnd)}</p>
                </div>
              )),
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/orders/${order.id}`}
              className="inline-flex min-h-[var(--target-web)] items-center justify-center rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {t("orders.actions.viewDetails")}
            </Link>
            {order.actions.map((action) => actionFor(order, action, { onCancel, onBuyAgain }, t))}
            {order.sellerGroups[0]?.sellerId ? (
              <Link
                to={`/messages?with=${encodeURIComponent(order.sellerGroups[0].sellerId)}`}
                className="inline-flex min-h-[var(--target-web)] items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <MessageSquare size={16} />
                {t("orders.actions.chat")}
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
