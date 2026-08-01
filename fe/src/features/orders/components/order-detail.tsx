import type { TFunction } from "i18next";
import { MessageSquare, RotateCcw, ShoppingCart, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { formatPrice } from "@/shared/lib";
import { Button } from "@/shared/ui";

import type { OrderAction, OrderView } from "../model/order-view";

import { OrderTimeline } from "./order-timeline";

interface OrderDetailProps {
  order: OrderView;
  onCancel: (order: OrderView) => void;
  onBuyAgain: (order: OrderView) => void;
}

function sellerLabel(order: OrderView): string {
  const group = order.sellerGroups[0];
  if (!group) return "seller-unavailable";
  return group.sellerName ?? group.sellerId;
}

function actionButton(
  action: OrderAction,
  order: OrderView,
  callbacks: Pick<OrderDetailProps, "onCancel" | "onBuyAgain">,
  t: TFunction,
) {
  const labelKey =
    action === "buy-again"
      ? "orders.actions.reorder"
      : action === "request-return"
        ? "orders.actions.return"
        : "orders.actions.cancel";
  if (action === "cancel") {
    return (
      <Button key={action} variant="outline" onClick={() => callbacks.onCancel(order)}>
        <XCircle size={16} />
        {t(labelKey)}
      </Button>
    );
  }

  if (action === "buy-again") {
    return (
      <Button key={action} variant="outline" onClick={() => callbacks.onBuyAgain(order)}>
        <ShoppingCart size={16} />
        {t(labelKey)}
      </Button>
    );
  }

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

export function OrderDetail({ order, onCancel, onBuyAgain }: OrderDetailProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-5">
        <article className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("orders.orderId")}</p>
              <h1 className="mt-1 break-all text-2xl font-bold text-foreground">
                {order.orderNumber ?? order.id}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("orders.sellerLabel", { seller: sellerLabel(order) })}
              </p>
              {order.placedAt ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("orders.placedAtLong", {
                    date: new Date(order.placedAt).toLocaleString(),
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {order.actions.map((action) =>
                actionButton(action, order, { onCancel, onBuyAgain }, t),
              )}
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
          </div>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">{t("orders.detail.items")}</h2>
          <div className="mt-4 space-y-3">
            {order.sellerGroups.flatMap((group) =>
              group.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("orders.itemQuantity", { count: item.quantity })}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-foreground">
                    {formatPrice(item.totalVnd)}
                  </p>
                </div>
              )),
            )}
          </div>
        </article>
      </section>

      <aside className="space-y-5">
        <article className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">{t("orders.detail.timeline")}</h2>
          <div className="mt-4">
            <OrderTimeline entries={order.timeline} />
          </div>
        </article>

        <article className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">{t("orders.detail.totals")}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{t("orders.detail.subtotal")}</dt>
              <dd className="font-medium text-foreground">
                {formatPrice(order.financial.subtotalVnd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{t("orders.detail.shipping")}</dt>
              <dd className="font-medium text-foreground">
                {formatPrice(order.financial.shippingVnd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">{t("orders.detail.discount")}</dt>
              <dd className="font-medium text-foreground">
                -{formatPrice(order.financial.discountVnd)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
              <dt className="font-semibold text-foreground">{t("orders.detail.total")}</dt>
              <dd className="text-lg font-bold text-foreground">
                {formatPrice(order.financial.totalVnd)}
              </dd>
            </div>
          </dl>
        </article>
      </aside>
    </div>
  );
}
