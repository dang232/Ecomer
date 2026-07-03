import { IconPackage, IconTruck, IconCircleCheck, IconCircleX, IconClock, IconRefresh, IconMapPin, IconMessage, IconStar, IconRotate, IconAlertCircle, IconLogin, IconArrowsLeftRight } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ImageWithFallback } from "../components/image-with-fallback";
import { Modal } from "../components/ui/modal";
import { useAuth } from "../hooks/use-auth";
import { useCart } from "../hooks/use-cart";
import { useCancelOrder, myOrdersOptions } from "../hooks/use-orders";
import { ApiError } from "../lib/api";
import { requestReturn } from "../lib/api/endpoints/orders";
import { getTracking } from "../lib/api/endpoints/shipping";
import { TRACKING_STEPS_FALLBACK } from "../lib/domain-constants";
import { parseOrderStatus } from "../lib/domain-enums";
import { formatPrice } from "../lib/format";
import type { Order as ServerOrder } from "../types/api";
import { type UIOrder } from "../types/ui";

type OrderTab = "all" | "pending" | "confirmed" | "shipping" | "delivered" | "cancelled";

const STATUS_CONFIG: Record<
  UIOrder["status"],
  { labelKey: string; icon: typeof IconPackage; color: string; bg: string }
> = {
  pending: { labelKey: "orders.status.pending", icon: IconClock, color: "var(--warning)", bg: "var(--warning-light)" },
  confirmed: {
    labelKey: "orders.status.confirmed",
    icon: IconCircleCheck,
    color: "var(--info)",
    bg: "var(--info-light)",
  },
  shipping: {
    labelKey: "orders.status.shipping",
    icon: IconTruck,
    color: "var(--primary)",
    bg: "var(--primary-light)",
  },
  delivered: {
    labelKey: "orders.status.delivered",
    icon: IconCircleCheck,
    color: "var(--success)",
    bg: "var(--success-light)",
  },
  cancelled: {
    labelKey: "orders.status.cancelled",
    icon: IconCircleX,
    color: "var(--error)",
    bg: "var(--error-light)",
  },
  returned: {
    labelKey: "orders.status.returned",
    icon: IconRotate,
    color: "var(--returned)",
    bg: "var(--returned-light)",
  },
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fromServer(o: ServerOrder): UIOrder {
  const sub = o.subOrders?.[0];
  const items =
    o.subOrders?.flatMap((s) =>
      (s.items ?? []).map((i) => ({
        productId: i.productId,
        name: i.name && !UUID_PATTERN.test(i.name) ? i.name : "Product",
        image: i.image ?? "",
        quantity: i.quantity,
        price: i.price,
      })),
    ) ?? [];
  return {
    id: o.id,
    date: o.createdAt ?? "",
    status: parseOrderStatus(o.status),
    items,
    itemCount: o.itemCount,
    total: o.total,
    shipping: o.shippingFee ?? 0,
    discount: o.discount ?? 0,
    address: o.address ? [o.address.street, o.address.city].filter(Boolean).join(", ") : "",
    trackingCode: sub?.trackingCode ?? undefined,
    carrier: sub?.carrier ?? undefined,
    seller: sub?.sellerName ?? "",
    paymentMethod: o.paymentMethod ?? "",
    estimatedDelivery: o.estimatedDelivery ?? undefined,
  };
}

function TrackingModal({ order, onClose, triggerRef }: {
  order: UIOrder;
  onClose: () => void;
  triggerRef?: React.RefObject<Element | null>;
}) {
  const { t } = useTranslation();
  // Real tracking is only fetchable when the order has both a tracking code
  // and a carrier — otherwise we degrade gracefully to the static timeline.
  const canFetch = !!(order.trackingCode && order.carrier);
  const tracking = useQuery({
    queryKey: ["shipping", "tracking", order.trackingCode, order.carrier],
    queryFn: () => getTracking(order.trackingCode ?? "", order.carrier ?? ""),
    enabled: canFetch,
    retry: false,
    staleTime: 30_000,
  });

  const events = tracking.data?.events ?? [];
  const showRealTimeline = canFetch && tracking.isSuccess && events.length > 0;
  const completedThrough =
    order.status === "delivered"
      ? TRACKING_STEPS_FALLBACK.length
      : order.status === "shipping"
        ? 4
        : order.status === "confirmed"
          ? 2
          : 1;

  return (
    <Modal
      open
      onClose={onClose}
      triggerRef={triggerRef}
      title={t("orders.tracking.modalTitle")}
      subtitle={<span className="font-mono">{order.trackingCode ?? order.id}</span>}
    >
      {canFetch && tracking.isLoading ? (
        <div className="space-y-3" role="status" aria-busy="true" aria-label={t("orders.tracking.loadingAria")}>
          {Array.from({ length: 4 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key -- decorative skeleton placeholders, no stable id
            <div key={i} className="flex gap-4">
              <div className="w-6 h-6 rounded-full bg-muted" />
              <div className="flex-1 h-4 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : showRealTimeline ? (
        <div className="space-y-4">
          {events.map((ev, i) => (
            // eslint-disable-next-line react/no-array-index-key -- TrackingEvent has no stable id; ordering is server-defined
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: i === 0 ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  <IconCircleCheck size={14} color="white" />
                </div>
                {i < events.length - 1 ? <div className="w-0.5 h-8 mt-1 bg-gray-200" /> : null}
              </div>
              <div className="pb-4 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {ev.status ?? t("orders.tracking.stepFallback")}
                </p>
                {ev.location ? <p className="text-xs text-muted-foreground mt-0.5">{ev.location}</p> : null}
                {ev.note ? <p className="text-xs text-muted-foreground mt-0.5">{ev.note}</p> : null}
                {ev.at ? <p className="text-[11px] text-muted-foreground mt-1">{ev.at}</p> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {TRACKING_STEPS_FALLBACK.map((label, i) => {
            const done = i < completedThrough;
            return (
              <div key={label} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: done ? "var(--primary)" : "var(--border)" }}
                  >
                    {done ? (
                      <IconCircleCheck size={14} color="white" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-gray-400" />
                    )}
                  </div>
                  {i < TRACKING_STEPS_FALLBACK.length - 1 ? (
                    <div
                      className="w-0.5 h-8 mt-1"
                      style={{ background: done ? "var(--primary)" : "var(--border)" }}
                    />
                  ) : null}
                </div>
                <div className="pb-4">
                  <p className={`text-sm font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(showRealTimeline ? tracking.data?.estimatedDelivery : order.estimatedDelivery) ? (
        <div
          className="mt-2 p-3 rounded-xl flex items-center gap-2 text-sm"
          style={{ background: "rgba(0,191,179,0.08)" }}
        >
          <IconMapPin size={15} style={{ color: "var(--primary)" }} />
          <span className="text-muted-foreground">
            {t("orders.tracking.estimated")}{" "}
            <strong>
              {showRealTimeline ? tracking.data?.estimatedDelivery : order.estimatedDelivery}
            </strong>
          </span>
        </div>
      ) : null}

      {canFetch && tracking.isError ? (
        <p className="text-[11px] text-amber-600 mt-4 flex items-center gap-1.5">
          <IconAlertCircle size={12} /> {t("orders.tracking.errorBanner")}
        </p>
      ) : !canFetch ? (
        <p className="text-[11px] text-muted-foreground mt-4 flex items-center gap-1.5">
          <IconAlertCircle size={12} /> {t("orders.tracking.noCodeBanner")}
        </p>
      ) : null}
    </Modal>
  );
}

function ReturnModal({
  order,
  onClose,
  onSubmit,
  isSubmitting,
  triggerRef,
}: {
  order: ServerOrder;
  onClose: () => void;
  onSubmit: (input: { subOrderId: string; reason: string }) => void;
  isSubmitting: boolean;
  triggerRef?: React.RefObject<Element | null>;
}) {
  const { t } = useTranslation();
  const subOrders = order.subOrders ?? [];
  const [subOrderId, setSubOrderId] = useState(subOrders[0]?.id ?? "");
  const [reason, setReason] = useState("");

  const handleSubmit = () => {
    if (!subOrderId) {
      toast.error(t("orders.return.noPackages"));
      return;
    }
    if (reason.trim().length < 10) {
      toast.error(t("orders.return.reasonTooShort"));
      return;
    }
    onSubmit({ subOrderId, reason: reason.trim() });
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={isSubmitting}
      triggerRef={triggerRef}
      title={t("orders.return.modalTitle")}
      subtitle={<span className="font-mono">{order.id}</span>}
      footer={
        <>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground"
          >
            {t("orders.return.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {isSubmitting ? t("orders.return.submitting") : t("orders.return.submit")}
          </button>
        </>
      }
    >
      {subOrders.length > 1 ? (
        <div className="mb-4">
          <label
            htmlFor="orders-return-suborder"
            className="block text-sm font-semibold text-foreground mb-2"
          >
            {t("orders.return.selectPackage")}
          </label>
          <select
            id="orders-return-suborder"
            value={subOrderId}
            onChange={(e) => setSubOrderId(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] bg-card"
          >
            {subOrders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sellerName ?? s.id} — {s.status}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label
        htmlFor="orders-return-reason"
        className="block text-sm font-semibold text-foreground mb-2"
      >
        {t("orders.return.reasonLabel")}
      </label>
      <textarea
        id="orders-return-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        maxLength={500}
        placeholder={t("orders.return.reasonPlaceholder")}
        className="w-full px-3 py-2.5 border border-border rounded-xl text-sm outline-none focus:border-[var(--primary)] resize-none bg-card"
        aria-describedby="orders-return-reason-counter"
      />
      <p id="orders-return-reason-counter" aria-live="polite" className="mt-1 text-xs text-muted-foreground text-right">
        {reason.length}/500
      </p>

      <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
        <IconAlertCircle size={14} className="shrink-0 mt-0.5" />
        <p>{t("orders.return.footnote")}</p>
      </div>
    </Modal>
  );
}

function OrderCard({
  order,
  rawOrder,
  onCancel,
  onReview,
  onReorder,
}: {
  order: UIOrder;
  rawOrder: ServerOrder;
  onCancel: (id: string) => void;
  onReview: (productId: string) => void;
  onReorder: (items: UIOrder["items"]) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showTracking, setShowTracking] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const trackingBtnRef = useRef<HTMLButtonElement | null>(null);
  const returnBtnRef = useRef<HTMLButtonElement | null>(null);
  const config = STATUS_CONFIG[order.status];
  const StatusIcon = config.icon;

  const submitReturn = useMutation({
    mutationFn: (input: { subOrderId: string; reason: string }) =>
      requestReturn({
        orderId: rawOrder.id,
        subOrderId: input.subOrderId,
        reason: input.reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["returns"] });
      setShowReturn(false);
      toast.success(t("orders.return.submitOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("orders.return.submitErr")),
  });

  return (
    <>
      {showTracking ? (
        <TrackingModal order={order} onClose={() => setShowTracking(false)} triggerRef={trackingBtnRef} />
      ) : null}
      {showReturn ? (
        <ReturnModal
          order={rawOrder}
          onClose={() => setShowReturn(false)}
          onSubmit={(input) => submitReturn.mutate(input)}
          isSubmitting={submitReturn.isPending}
          triggerRef={returnBtnRef}
        />
      ) : null}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-[var(--radius-lg)] p-5 mb-3 transition-all hover:border-border-hover hover:shadow-sm"
      >
        {/* Top row: order ID + date | status pill */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">
              {t("orders.orderNumber", { defaultValue: "Order" })} #{order.id.slice(0, 8).toUpperCase()}
            </span>
            {order.date ? (
              <span className="text-xs text-muted-foreground">
                {new Date(order.date).toLocaleDateString()}
              </span>
            ) : null}
          </div>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: config.bg, color: config.color }}
          >
            <StatusIcon size={12} />
            {t(config.labelKey)}
          </div>
        </div>

        {/* Items */}
        {order.items.length === 0 && order.itemCount && order.itemCount > 0 ? (
          <p className="text-sm text-muted-foreground italic mb-3">
            {t("orders.itemCountSummary", {
              count: order.itemCount,
              defaultValue: `${order.itemCount} sản phẩm`,
            })}
          </p>
        ) : null}
        {order.items.map((item) => (
          <div
            key={`${item.productId}-${item.variant ?? ""}`}
            className="flex items-center gap-3 mb-3"
          >
            <ImageWithFallback
              src={item.image ?? ""}
              alt={item.name}
              className="w-14 h-14 rounded-[var(--radius-md)] object-cover border border-border flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground line-clamp-2">{item.name}</p>
              <span className="text-xs text-muted-foreground">x{item.quantity}</span>
            </div>
          </div>
        ))}

        {/* Bottom row: total + actions */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-[15px] font-bold text-primary">{formatPrice(order.total)}</span>
          <div className="flex gap-2">
            {order.status === "shipping" ? (
              <button
                ref={trackingBtnRef}
                onClick={() => setShowTracking(true)}
                className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-border text-text-secondary hover:bg-muted flex items-center gap-1.5"
              >
                <IconMapPin size={13} /> {t("orders.actions.track")}
              </button>
            ) : null}
            {order.status === "delivered" ? (
              <>
                <button
                  onClick={() => onReorder(order.items)}
                  className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-border text-text-secondary hover:bg-muted flex items-center gap-1.5"
                >
                  <IconRefresh size={13} /> {t("orders.actions.reorder")}
                </button>
                <button
                  ref={returnBtnRef}
                  onClick={() => setShowReturn(true)}
                  className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-amber-200 text-amber-600 hover:bg-amber-50 flex items-center gap-1.5"
                >
                  <IconArrowsLeftRight size={13} /> {t("orders.actions.return")}
                </button>
                <button
                  onClick={() => {
                    const firstProduct = order.items[0]?.productId;
                    if (firstProduct) onReview(firstProduct);
                    else toast.info(t("orders.noReviewableProduct"));
                  }}
                  className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium bg-primary text-white border border-primary flex items-center gap-1.5"
                >
                  <IconStar size={13} /> {t("orders.actions.review")}
                </button>
              </>
            ) : null}
            {order.status === "pending" ? (
              <button
                onClick={() => setCancelId(order.id)}
                className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 flex items-center gap-1.5"
              >
                <IconCircleX size={13} /> {t("orders.actions.cancel")}
              </button>
            ) : null}
            <button
              onClick={() => {
                const sellerId = rawOrder.subOrders?.[0]?.sellerId;
                if (!sellerId) {
                  toast.info(t("orders.noSellerForChat"));
                  return;
                }
                void navigate(`/messages?with=${encodeURIComponent(sellerId)}`);
              }}
              className="px-3.5 py-1.5 rounded-[var(--radius-md)] text-xs font-medium border border-border text-text-secondary hover:bg-muted flex items-center gap-1.5"
            >
              <IconMessage size={13} /> {t("orders.actions.chat")}
            </button>
          </div>
        </div>
      </motion.div>
      <Modal
        open={cancelId !== null}
        onClose={() => setCancelId(null)}
        title={t("orders.cancelDialog.title", { defaultValue: "Cancel order?" })}
        size="sm"
        footer={
          <div className="flex gap-3 justify-center w-full">
            <button
              type="button"
              onClick={() => setCancelId(null)}
              className="px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium border border-border bg-transparent text-foreground hover:bg-background transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (cancelId) onCancel(cancelId);
                setCancelId(null);
              }}
              className="px-5 py-2.5 rounded-[var(--radius-lg)] text-sm font-medium bg-error text-white hover:opacity-90 transition-opacity"
            >
              {t("orders.actions.cancel")}
            </button>
          </div>
        }
      >
        <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4 [&>svg]:w-6 [&>svg]:h-6" aria-hidden="true">
          <IconCircleX size={24} />
        </div>
        <p className="text-sm text-text-secondary mb-4 text-center">
          {t("orders.cancelDialog.description", {
            defaultValue: "This will cancel your order. You won't be able to undo this.",
          })}
        </p>
      </Modal>
    </>
  );
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { ready, authenticated, login } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
  const [page, setPage] = useState(0);
  const ordersQuery = useSuspenseQuery(myOrdersOptions({ page, size: 20 }));
  const cancelOrder = useCancelOrder();
  const { addItemAsync } = useCart();
  const { t } = useTranslation();

  const handleReorder = async (items: UIOrder["items"]) => {
    if (items.length === 0) {
      toast.info(t("orders.reorder.noItems"));
      return;
    }
    let added = 0;
    let failed = 0;
    for (const item of items) {
      try {
        await addItemAsync({ productId: item.productId, quantity: item.quantity });
        added += 1;
      } catch (err) {
        // Continue trying remaining items so we get a full count.
        if (added === 0 && failed === 0) {
          // All items failed -- surface the first error immediately.
          toast.error(err instanceof ApiError ? err.message : t("orders.reorder.addError"));
          return;
        }
        failed += 1;
      }
    }
    if (added === 0) return; // all failed; error toast already shown above
    if (failed > 0) {
      // Partial success: tell the user how many landed vs. how many didn't.
      toast.success(
        t("orders.reorder.partialSuccess", {
          added,
          total: items.length,
          failed,
          defaultValue: "Added " + added + " of " + items.length + " items -- " + failed + " unavailable.",
        }),
        {
          action: {
            label: t("orders.reorder.viewCart", { defaultValue: "View cart" }),
            onClick: () => void navigate("/cart"),
          },
        },
      );
    } else {
      // Full success: offer an optional cart CTA instead of auto-navigating.
      toast(t("orders.reorder.added", { count: added }), {
        action: {
          label: t("orders.reorder.viewCart", { defaultValue: "View cart" }),
          onClick: () => void navigate("/cart"),
        },
      });
    }
  };

  const allOrders = useMemo(() => {
    const content = ordersQuery.data?.content ?? [];
    return content.map((server) => ({ ui: fromServer(server), raw: server }));
  }, [ordersQuery.data]);

  const filtered = useMemo(
    () => (activeTab === "all" ? allOrders : allOrders.filter((o) => o.ui.status === activeTab)),
    [allOrders, activeTab],
  );

  const tabs: { id: OrderTab; labelKey: string }[] = [
    { id: "all", labelKey: "orders.tabs.all" },
    { id: "pending", labelKey: "orders.tabs.pending" },
    { id: "shipping", labelKey: "orders.tabs.shipping" },
    { id: "delivered", labelKey: "orders.tabs.delivered" },
    { id: "cancelled", labelKey: "orders.tabs.cancelled" },
  ];

  const handleCancel = (id: string) => {
    cancelOrder.mutate(id, {
      onSuccess: () => toast.success(t("orders.cancelOk")),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("orders.cancelErr")),
    });
  };

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<OrderTab, number>> = {};
    for (const { ui } of allOrders) {
      const s = ui.status as OrderTab;
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [allOrders]);

  if (!ready) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-sm text-muted-foreground">
        {t("orders.initSession")}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <IconPackage size={64} className="mx-auto mb-6 text-gray-200" />
        <h2 className="text-xl font-bold text-muted-foreground mb-3">{t("orders.loginPromptTitle")}</h2>
        <button
          onClick={() => login("/orders")}
          className="px-8 py-3 rounded-xl text-white font-semibold inline-flex items-center gap-2"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-deep))" }}
        >
          <IconLogin size={16} /> {t("auth.login")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto py-8 px-8">
      <h1 className="text-2xl font-bold text-foreground mb-6">{t("orders.pageTitle")}</h1>

      <div role="tablist" aria-label="Order status" className="flex gap-1 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "all" ? allOrders.length : (tabCounts[tab.id] ?? 0);
          return (
            <button
              key={tab.id}
              id={`orders-tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab.id);
                setPage(0);
              }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                isActive
                  ? "bg-primary text-white border-primary"
                  : "bg-transparent text-text-secondary border-border hover:border-border-hover"
              }`}
            >
              {t(tab.labelKey)}
              {count > 0 ? (
                <span className="bg-accent text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ml-1">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`orders-tab-${activeTab}`}>
        {filtered.length > 0
          ? filtered.map((entry) => (
              <OrderCard
                key={entry.ui.id}
                order={entry.ui}
                rawOrder={entry.raw}
                onCancel={handleCancel}
                onReview={(productId) => navigate(`/product/${productId}`)}
                onReorder={(items) => void handleReorder(items)}
              />
            ))
          : null}
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-[var(--radius-lg)] border border-border">
            <IconPackage size={48} className="mx-auto mb-4 text-gray-200" />
            <p className="text-muted-foreground font-medium">{t("orders.empty")}</p>
          </div>
        ) : null}
      </div>

      {(ordersQuery.data?.totalPages ?? 0) > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={ordersQuery.data?.first ?? true}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            {t("common.prev")}
          </button>
          <span aria-current="page" className="text-sm text-muted-foreground">
            {(ordersQuery.data?.page ?? page) + 1} / {ordersQuery.data?.totalPages ?? 1}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={ordersQuery.data?.last ?? true}
            className="px-4 py-2 rounded-[var(--radius-md)] border border-border text-sm font-medium disabled:opacity-40 hover:bg-muted transition-colors"
          >
            {t("common.next")}
          </button>
        </nav>
      ) : null}
    </div>
  );
}
