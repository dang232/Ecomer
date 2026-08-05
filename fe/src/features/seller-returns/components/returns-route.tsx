import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Package, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import {
  approveReturn,
  completeReturn,
  listSellerReturns,
  rejectReturn,
} from "@/shared/api/endpoints/returns";

import { RETURN_TAB_VALUES, toSellerReturnRow, type ReturnTab } from "../model/return-queue-view";

import { RejectReturnDialog } from "./reject-return-dialog";

const STATUS_BADGE: Record<string, { labelKey: string; tone: string }> = {
  REQUESTED: { labelKey: "return.status.requested", tone: "var(--warning)" },
  APPROVED: { labelKey: "return.status.approved", tone: "var(--info)" },
  REJECTED: { labelKey: "return.status.rejected", tone: "var(--error)" },
  COMPLETED: { labelKey: "return.status.completed", tone: "var(--success)" },
  DISPUTED: { labelKey: "return.status.disputed", tone: "var(--returned)" },
};

export function ReturnsRoute() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ReturnTab>("requested");
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const returnsQuery = useQuery({
    queryKey: ["seller", "returns"],
    queryFn: listSellerReturns,
    refetchInterval: 60_000,
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (returnId: string) => approveReturn(returnId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "returns"] });
      toast.success(t("return.seller.approveSuccess"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("return.seller.approveError")),
  });

  const reject = useMutation({
    mutationFn: (returnId: string) => rejectReturn(returnId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "returns"] });
      toast.success(t("return.seller.rejectSuccess"));
      setRejectFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("return.seller.rejectError")),
  });

  const complete = useMutation({
    mutationFn: (returnId: string) => completeReturn(returnId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "returns"] });
      toast.success(t("return.seller.completeSuccess"));
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("return.seller.completeError")),
  });

  const allReturns = useMemo(
    () => (returnsQuery.data ?? []).map(toSellerReturnRow),
    [returnsQuery.data],
  );

  const tabLabels: Record<ReturnTab, string> = {
    requested: t("return.status.requested"),
    approved: t("return.status.approved"),
    completed: t("return.status.completed"),
    rejected: t("return.status.rejected"),
  };

  const filtered = useMemo(() => {
    return allReturns.filter((r) => {
      switch (tab) {
        case "requested":
          return r.status === "REQUESTED";
        case "approved":
          return r.status === "APPROVED";
        case "completed":
          return r.status === "COMPLETED";
        case "rejected":
          return r.status === "REJECTED";
      }
    });
  }, [allReturns, tab]);

  const handleReject = (returnId: string) => {
    reject.mutate(returnId);
  };

  return (
    <div className="space-y-5">
      <RejectReturnDialog
        returnId={rejectFor}
        isPending={reject.isPending}
        onClose={() => setRejectFor(null)}
        onReject={handleReject}
      />

      {/* Tab pills */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t("return.seller.title")}
      >
        {RETURN_TAB_VALUES.map((id) => (
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
            {tabLabels[id]}
          </button>
        ))}
      </div>

      {/* Loading */}
      {returnsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.orders.loading")}</p>
      ) : null}

      {/* Error */}
      {returnsQuery.error instanceof ApiError ? (
        <div className="bg-card border border-error/30 rounded-[var(--radius-lg)] p-6 text-center flex flex-col items-center gap-3">
          <AlertCircle size={36} className="text-error" aria-hidden="true" />
          <p className="text-sm text-error font-medium">
            {t("seller.orders.loadError", { message: returnsQuery.error.message })}
          </p>
          <button
            type="button"
            onClick={() => void returnsQuery.refetch()}
            className="mt-1 px-4 py-2 text-sm font-medium rounded-[var(--radius-md)] bg-primary text-white hover:bg-primary/90 transition-colors"
          >
            {t("seller.orders.retry", { defaultValue: "Retry" })}
          </button>
        </div>
      ) : null}

      {/* Empty — no returns at all */}
      {!returnsQuery.isLoading && allReturns.length === 0 && !returnsQuery.error ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] p-8 text-center">
          <Package size={40} className="mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("return.seller.empty")}</p>
        </div>
      ) : null}

      {/* Empty — returns exist but none match this tab */}
      {!returnsQuery.isLoading && allReturns.length > 0 && filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] p-6 text-center">
          <p className="text-sm text-muted-foreground">{t("seller.orders.filterEmpty")}</p>
        </div>
      ) : null}

      {/* List */}
      {filtered.length > 0 ? (
        <div className="bg-card border border-border rounded-[var(--radius-lg)] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] px-5 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("return.seller.title")}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("seller.orders.colActions", { defaultValue: "Actions" })}
            </span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((ret) => {
              const badge = STATUS_BADGE[ret.status] ?? STATUS_BADGE.REQUESTED;
              return (
                <div key={ret.id} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <RotateCcw size={14} className="text-muted-foreground" aria-hidden="true" />
                      <span className="text-xs font-mono font-bold text-muted-foreground">
                        #{ret.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: "var(--muted)",
                          color: badge.tone,
                        }}
                      >
                        {t(badge.labelKey)}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-1">{ret.reason ?? "—"}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {ret.action === "approve" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => approve.mutate(ret.id)}
                          disabled={approve.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary-hover transition-colors"
                        >
                          <CheckCircle2 size={13} aria-hidden="true" />
                          {t("return.seller.approve")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectFor(ret.id)}
                          disabled={reject.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold border border-error/30 text-error disabled:opacity-50 hover:bg-error-light transition-colors"
                        >
                          {t("return.seller.reject")}
                        </button>
                      </>
                    ) : null}
                    {ret.action === "complete" ? (
                      <button
                        type="button"
                        onClick={() => complete.mutate(ret.id)}
                        disabled={complete.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold border border-primary/30 text-primary disabled:opacity-50 hover:bg-primary-light transition-colors"
                      >
                        <CheckCircle2 size={13} aria-hidden="true" />
                        {t("return.seller.complete")}
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
