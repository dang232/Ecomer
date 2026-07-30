import { IconAlertCircle, IconCircleCheck, IconPackage, IconSearch, IconTruck } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import {
  sellerAcceptOrder,
  sellerRejectOrder,
  sellerShipOrder,
} from "@/shared/api/endpoints/orders";

import type { toSellerOrderRow } from "../model/order-queue-view";

import { OrderDetailDrawer } from "./order-detail-drawer";
import { RejectOrderDialog } from "./reject-order-dialog";
import { ShipOrderDialog } from "./ship-order-dialog";

export interface OrderQueueRouteState {
  q: string;
  selected: string | null;
}

interface OrderQueueProps {
  orders: ReturnType<typeof toSellerOrderRow>[];
  isLoading: boolean;
  error: unknown;
  routeState: OrderQueueRouteState;
  onRouteChange: (next: Partial<OrderQueueRouteState>) => void;
  onRetry?: () => void;
}

export function OrderQueue({
  orders,
  isLoading,
  error,
  routeState,
  onRouteChange,
  onRetry,
}: OrderQueueProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [shipFor, setShipFor] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [confirmOrderId, setConfirmOrderId] = useState<string | null>(null);

  const selectedRow = orders.find((r) => r.id === routeState.selected) ?? null;

  const accept = useMutation({
    mutationFn: (subOrderId: string) => sellerAcceptOrder(subOrderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "orders"] });
      toast.success(t("seller.orders.acceptOk"));
      setConfirmOrderId(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.acceptErr")),
  });

  const reject = useMutation({
    mutationFn: (subOrderId: string) => sellerRejectOrder(subOrderId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "orders"] });
      toast.success(t("seller.orders.rejectOk"));
      setRejectFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.rejectErr")),
  });

  const ship = useMutation({
    mutationFn: ({
      subOrderId,
      body,
    }: {
      subOrderId: string;
      body: { carrier: string; trackingNumber: string };
    }) => sellerShipOrder(subOrderId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "orders"] });
      toast.success(t("seller.orders.shipOk"));
      setShipFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.orders.shipErr")),
  });

  const pendingMutationIds = new Set([
    ...(accept.isPending ? [confirmOrderId].filter(Boolean) : []),
    ...(reject.isPending ? [rejectFor].filter(Boolean) : []),
    ...(ship.isPending ? [shipFor].filter(Boolean) : []),
  ]);

  return (
    <div className="space-y-5">
      <ShipOrderDialog
        subOrderId={shipFor ?? ""}
        open={!!shipFor}
        onClose={() => setShipFor(null)}
        onSubmit={(body) => {
          if (shipFor) ship.mutate({ subOrderId: shipFor, body });
        }}
        isSubmitting={ship.isPending}
      />

      <RejectOrderDialog
        subOrderId={rejectFor ?? ""}
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        onConfirm={() => {
          if (rejectFor) reject.mutate(rejectFor);
        }}
        isSubmitting={reject.isPending}
      />

      {/* Accept confirm — uses the existing seller.orders.confirmDialog key */}
      {confirmOrderId ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-foreground mb-2">
              {t("seller.orders.confirmDialog.title")}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {t("seller.orders.confirmDialog.body")}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOrderId(null)}
                disabled={accept.isPending}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
              >
                {t("common.cancel", { defaultValue: "Cancel" })}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmOrderId) accept.mutate(confirmOrderId);
                }}
                disabled={accept.isPending}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {accept.isPending
                  ? t("common.submitting", { defaultValue: "Submitting..." })
                  : t("seller.orders.confirmDialog.confirm")}
              </button>
            </div>
          </div>
        </div> : null}

      {/* Toolbar: search only */}
      <div className="sm:ml-auto flex items-center gap-2 bg-card border border-border rounded-[var(--radius-md)] px-3 py-1.5 w-full sm:w-72">
        <IconSearch size={14} className="text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={routeState.q}
          onChange={(e) => onRouteChange({ q: e.target.value })}
          placeholder={t("seller.orders.searchPlaceholder")}
          className="flex-1 text-sm outline-none bg-transparent"
          aria-label={t("seller.orders.searchPlaceholder")}
        />
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
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              {t("seller.orders.retry")}
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

      {/* Orders table */}
      {orders.length > 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.colOrder")}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.colActions")}
            </span>
          </div>
          <div className="divide-y divide-border">
            {orders.map((row) => {
              const isRowPending = pendingMutationIds.has(row.id);
              return (
                <div
                  key={row.id}
                  className="px-5 py-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-background transition-colors"
                  onClick={() => onRouteChange({ selected: row.id })}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      onRouteChange({ selected: row.id });
                    }
                  }}
                  aria-label={t("seller.orders.openDetail", { id: row.id })}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        {row.id}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {t("seller.orders.parentOrder", { id: row.orderId })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{row.itemSummary}</p>
                  </div>
                  <div
                    className="flex gap-2 shrink-0"
                    role="group"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {row.actions.includes("accept") ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmOrderId(row.id)}
                          disabled={isRowPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary-hover transition-colors"
                        >
                          <IconCircleCheck size={13} aria-hidden="true" />
                          {t("seller.orders.accept")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectFor(row.id)}
                          disabled={isRowPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold border border-error/30 text-error disabled:opacity-50 hover:bg-error-light transition-colors"
                        >
                          {t("seller.orders.reject")}
                        </button>
                      </>
                    ) : null}
                    {row.actions.includes("ship") ? (
                      <button
                        type="button"
                        onClick={() => setShipFor(row.id)}
                        disabled={isRowPending}
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

      <OrderDetailDrawer
        row={selectedRow}
        onClose={() => onRouteChange({ selected: null })}
      />
    </div>
  );
}
