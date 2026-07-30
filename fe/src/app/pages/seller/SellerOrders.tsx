import {
  IconAlertCircle,
  IconCircleCheck,
  IconPackage,
  IconSearch,
  IconTruck,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { StatusPill } from "@/shared/ui";
import { ApiError } from "@/shared/api";
import {
  sellerAcceptOrder,
  sellerRejectOrder,
  sellerShipOrder,
  type PendingSubOrder,
} from "@/shared/api/endpoints/orders";

import { ShipDialog } from "./ShipDialog";

const STATUS_TABS = [
  { id: "all", match: () => true },
  {
    id: "pending",
    match: (s: string) =>
      s.toUpperCase().includes("PENDING") ||
      (s.toUpperCase().includes("ACCEPT") && !s.toUpperCase().includes("ACCEPTED")),
  },
  {
    id: "accepted",
    match: (s: string) =>
      s.toUpperCase().includes("ACCEPTED") && !s.toUpperCase().includes("PACKED"),
  },
  { id: "packed", match: (s: string) => s.toUpperCase().includes("PACKED") },
  { id: "shipped", match: (s: string) => s.toUpperCase().includes("SHIPPED") },
  {
    id: "cancelled",
    match: (s: string) => s.toUpperCase().includes("CANCEL") || s.toUpperCase().includes("REJECT"),
  },
] as const;

type TabId = (typeof STATUS_TABS)[number]["id"];

export function SellerOrders({
  orders,
  search,
  onSearch,
  isLoading,
  error,
  onRetry,
}: {
  orders: PendingSubOrder[];
  search: string;
  onSearch: (value: string) => void;
  isLoading: boolean;
  error: unknown;
  onRetry?: () => void;
}) {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [shipFor, setShipFor] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("all");

  const accept = useMutation({
    mutationFn: (subOrderId: string) => sellerAcceptOrder(subOrderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "pending-orders"] });
      toast.success(t("seller.orders.acceptOk"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.acceptErr")),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      sellerRejectOrder(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "pending-orders"] });
      toast.success(t("seller.orders.rejectOk"));
      setRejectFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.rejectErr")),
  });

  const ship = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { carrier: string; trackingNumber: string } }) =>
      sellerShipOrder(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "pending-orders"] });
      toast.success(t("seller.orders.shipOk"));
      setShipFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.shipErr")),
  });

  const filtered = useMemo(() => {
    const tabMatcher = STATUS_TABS.find((s) => s.id === tab)?.match ?? (() => true);
    return orders.filter((o) => {
      if (!tabMatcher(o.status)) return false;
      return true;
    });
  }, [orders, tab]);

  return (
    <div className="space-y-5">
      <ShipDialog
        subOrderId={shipFor}
        onClose={() => setShipFor(null)}
        onSubmit={(body) => {
          if (shipFor) ship.mutate({ id: shipFor, body });
        }}
        isSubmitting={ship.isPending}
      />
      <FormDialog
        open={!!confirmOrderId}
        title={t("seller.orders.confirmDialog.title")}
        description={t("seller.orders.confirmDialog.body")}
        submitLabel={t("seller.orders.confirmDialog.confirm")}
        submitColor="var(--primary)"
        fields={[]}
        onClose={() => setConfirmOrderId(null)}
        onSubmit={() => {
          if (confirmOrderId) {
            accept.mutate(confirmOrderId);
            setConfirmOrderId(null);
          }
        }}
        isSubmitting={accept.isPending}
      />
      <FormDialog
        open={!!rejectFor}
        title={t("seller.rejectDialog.title")}
        description={rejectFor ? t("seller.rejectDialog.subtitle", { id: rejectFor }) : undefined}
        submitLabel={t("seller.rejectDialog.submitLabel")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("seller.rejectDialog.reasonLabel"),
            placeholder: t("seller.rejectDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setRejectFor(null)}
        onSubmit={({ reason }) => {
          if (rejectFor) reject.mutate({ id: rejectFor, reason });
        }}
        isSubmitting={reject.isPending}
      />

      {/* Tab pills + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div
          className="flex gap-1.5 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t("seller.orders.title")}
        >
          {STATUS_TABS.map(({ id }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={[
                "shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border",
                tab === id
                  ? "bg-primary-light text-primary border-primary"
                  : "bg-transparent text-text-secondary border-border hover:bg-background",
              ].join(" ")}
            >
              {t(`seller.orders.tabs.${id}`)}
            </button>
          ))}
        </div>
        <div className="sm:ml-auto flex items-center gap-2 bg-card border border-border rounded-[var(--radius-md)] px-3 py-1.5 w-full sm:w-72">
          <IconSearch size={14} className="text-muted-foreground" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t("seller.orders.searchPlaceholder")}
            className="flex-1 text-sm outline-none bg-transparent"
            aria-label={t("seller.orders.searchPlaceholder")}
          />
        </div>
      </div>

      {/* States */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.orders.loading")}</p>
      ) : null}
      {error instanceof ApiError ? (
        <div className="bg-card border border-error/30 rounded-[var(--radius-lg)] p-6 text-center flex flex-col items-center gap-3">
          <IconAlertCircle size={36} className="text-error" aria-hidden="true" />
          <p className="text-sm text-error font-medium">
            {t("seller.orders.loadError", { message: error.message })}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("seller.orders.loadErrorHint", {
              defaultValue: "This may be temporary. Try refreshing.",
            })}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              {t("seller.orders.retry", { defaultValue: "Retry" })}
            </button>
          ) : null}
        </div>
      ) : null}
      {!isLoading && orders.length === 0 && !error ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] p-8 text-center">
          <IconPackage
            size={40}
            className="mx-auto mb-3 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">{t("seller.orders.empty")}</p>
        </div>
      ) : null}
      {!isLoading && orders.length > 0 && filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("seller.orders.filterEmpty")}</p>
        </div>
      ) : null}

      {/* Orders table */}
      {filtered.length > 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto] px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.colOrder", { defaultValue: "Order" })}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.colActions", { defaultValue: "Actions" })}
            </span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((order) => {
              const status = order.status.toUpperCase();
              const isPending =
                status.includes("PENDING") ||
                (status.includes("ACCEPT") && !status.includes("ACCEPTED"));
              const isAccepted =
                status.includes("ACCEPTED") ||
                (status.includes("PACK") && !status.includes("PACKED"));
              return (
                <div key={order.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        {order.id}
                      </span>
                      <StatusPill status={order.status} />
                    </div>
                    <p className="text-sm text-text-secondary">
                      {t("seller.orders.parentOrder", { id: order.orderId })}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmOrderId(order.id)}
                          disabled={accept.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary-hover transition-colors"
                        >
                          <IconCircleCheck size={13} aria-hidden="true" />
                          {t("seller.orders.accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectFor(order.id)}
                          disabled={reject.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold border border-error/30 text-error disabled:opacity-50 hover:bg-error-light transition-colors"
                        >
                          {t("seller.orders.reject")}
                        </button>
                      </>
                    ) : null}
                    {isAccepted ? (
                      <button
                        type="button"
                        onClick={() => setShipFor(order.id)}
                        disabled={ship.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary-hover transition-colors"
                      >
                        <IconTruck size={13} aria-hidden="true" />
                        {t("seller.orders.ship")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
