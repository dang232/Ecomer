import { ArrowLeft, CreditCard, MapPin, Package, RefreshCw, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { ImageWithFallback } from "../components/image-with-fallback";
import { useAuth } from "../hooks/use-auth";
import { useOrder } from "../hooks/use-orders";
import { ApiError } from "../lib/api";
import { formatDate, formatPrice } from "../lib/format";

const STATUS_STYLES = {
  pending: "bg-warning-light text-warning",
  confirmed: "bg-info-light text-info",
  shipping: "bg-primary-light text-primary",
  delivered: "bg-success-light text-success",
  cancelled: "bg-error-light text-error",
  returned: "bg-returned-light text-returned",
} as const;

const PAYMENT_STATUS_KEYS: Record<string, string> = {
  PENDING: "orders.detail.paymentPending",
  COMPLETED: "orders.detail.paymentCompleted",
  FAILED: "orders.detail.paymentFailed",
};

function OrderDetailSkeleton() {
  return (
    <div className="max-w-[1100px] mx-auto px-4 py-8 space-y-5" aria-busy="true">
      <div className="h-8 w-56 rounded bg-surface-elevated animate-pulse" />
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="h-96 rounded-[var(--radius-lg)] border border-border bg-card animate-pulse" />
        <div className="h-72 rounded-[var(--radius-lg)] border border-border bg-card animate-pulse" />
      </div>
    </div>
  );
}

function PaymentStatusLabel({ status }: { status?: string }) {
  const { t } = useTranslation();
  const key = status ? PAYMENT_STATUS_KEYS[status] : undefined;
  return <>{key ? t(key) : status || t("orders.detail.unknownPayment")}</>;
}

export function OrderDetailPage() {
  const { ready, authenticated, login } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const orderQuery = useOrder(id);

  if (!ready) {
    return <OrderDetailSkeleton />;
  }

  if (!authenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="text-xl font-bold text-foreground mb-3">{t("orders.loginPromptTitle")}</h1>
        <button
          type="button"
          onClick={() => login(`/orders/${id ?? ""}`)}
          className="px-6 py-3 rounded-[var(--radius-lg)] bg-primary text-white font-semibold"
        >
          {t("auth.login")}
        </button>
      </div>
    );
  }

  if (orderQuery.isLoading) {
    return <OrderDetailSkeleton />;
  }

  const isNotFound = orderQuery.error instanceof ApiError && orderQuery.error.status === 404;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center" role="alert">
        <Package size={52} className="mx-auto mb-4 text-muted-foreground/40" aria-hidden="true" />
        <h1 className="text-xl font-bold text-foreground mb-3">
          {t(isNotFound ? "orders.detail.notFound" : "orders.detail.loadError")}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {isNotFound
            ? t("orders.detail.notFoundDescription")
            : t("orders.detail.loadErrorDescription")}
        </p>
        <div className="flex justify-center gap-3">
          {!isNotFound ? (
            <button
              type="button"
              onClick={() => void orderQuery.refetch()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius-lg)] bg-primary text-white font-semibold"
            >
              <RefreshCw size={16} aria-hidden="true" />
              {t("orders.detail.retry")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate("/orders")}
            className="px-5 py-2.5 rounded-[var(--radius-lg)] border border-border text-foreground font-semibold"
          >
            {t("orders.backToHome")}
          </button>
        </div>
      </div>
    );
  }

  const order = orderQuery.data;
  const orderItems =
    order.subOrders?.flatMap((subOrder) =>
      (subOrder.items ?? []).map((item) => ({ item, subOrderId: subOrder.id })),
    ) ?? [];
  const statusClass = STATUS_STYLES[order.status];
  const displayOrderNumber = order.orderNumber ?? order.id;
  const address = order.address;

  return (
    <main className="max-w-[1100px] mx-auto px-4 py-8">
      <button
        type="button"
        onClick={() => navigate("/orders")}
        className="inline-flex items-center gap-2 mb-6 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        {t("orders.detail.back")}
      </button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            {t("orders.detail.orderNumber")}
          </p>
          <h1 className="text-2xl font-bold text-foreground break-all">{displayOrderNumber}</h1>
          {order.createdAt ? (
            <p className="text-sm text-muted-foreground mt-2">
              {t("orders.detail.createdAt", { date: formatDate(order.createdAt) })}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-sm font-semibold ${statusClass}`}
        >
          {t(`orders.status.${order.status}`)}
        </span>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Package size={19} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">{t("orders.detail.items")}</h2>
            </div>
            {orderItems.length > 0 ? (
              <div className="divide-y divide-border">
                {orderItems.map(({ item, subOrderId }) => (
                  <div
                    key={`${subOrderId}-${item.productId}-${item.variantId ?? ""}`}
                    className="flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <Link
                      to={`/product/${item.productId}`}
                      aria-label={t("orders.viewProduct", {
                        name: item.name ?? t("orders.detail.productFallback"),
                      })}
                      className="shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ImageWithFallback
                        src={item.image ?? ""}
                        alt={item.name ?? t("orders.detail.productFallback")}
                        className="h-16 w-16 rounded-[var(--radius-md)] border border-border object-cover"
                      />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${item.productId}`}
                        className="block rounded font-medium text-foreground break-words hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.name ?? t("orders.detail.productFallback")}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("orders.detail.quantity", { count: item.quantity })}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("orders.detail.unitPrice")} {formatPrice(item.price)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-foreground">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("orders.detail.noItems")}</p>
            )}
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={19} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">
                {t("orders.detail.deliveryAddress")}
              </h2>
            </div>
            {address ? (
              <address className="not-italic text-sm leading-6 text-muted-foreground">
                {[address.street, address.ward, address.district, address.city]
                  .filter(Boolean)
                  .join(", ")}
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("orders.detail.addressUnavailable")}
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={19} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">{t("orders.detail.payment")}</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("orders.detail.paymentMethod")}</dt>
                <dd className="font-medium text-foreground">
                  {order.paymentMethod ?? t("orders.detail.unknownPayment")}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("orders.detail.paymentStatus")}</dt>
                <dd className="font-medium text-foreground">
                  <PaymentStatusLabel status={order.paymentStatus} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={19} className="text-primary" aria-hidden="true" />
              <h2 className="font-semibold text-foreground">{t("orders.detail.totals")}</h2>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("orders.detail.subtotal")}</dt>
                <dd className="font-medium text-foreground">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("orders.detail.shipping")}</dt>
                <dd className="font-medium text-foreground">{formatPrice(order.shippingFee)}</dd>
              </div>
              {order.discount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("orders.detail.discount")}</dt>
                  <dd className="font-medium text-success">-{formatPrice(order.discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-border pt-3">
                <dt className="font-semibold text-foreground">{t("orders.detail.total")}</dt>
                <dd className="font-bold text-primary">{formatPrice(order.total)}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
