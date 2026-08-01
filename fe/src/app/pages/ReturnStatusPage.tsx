import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Package,
  RotateCcw,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { AccountNav } from "@/features/account";
import { ApiError } from "@/shared/api";
import {
  getReturn,
  listReturns,
  openDispute,
  type Return,
  type ReturnStatus,
} from "@/shared/api/endpoints/returns";
import { formatPrice } from "@/shared/lib";
import { Modal } from "@/shared/ui";

const STATUS_CONFIG: Record<
  ReturnStatus,
  { labelKey: string; icon: typeof Clock; color: string; bg: string }
> = {
  REQUESTED: {
    labelKey: "return.status.requested",
    icon: Clock,
    color: "var(--warning)",
    bg: "var(--warning-light)",
  },
  APPROVED: {
    labelKey: "return.status.approved",
    icon: CheckCircle2,
    color: "var(--info)",
    bg: "var(--info-light)",
  },
  REJECTED: {
    labelKey: "return.status.rejected",
    icon: XCircle,
    color: "var(--error)",
    bg: "var(--error-light)",
  },
  COMPLETED: {
    labelKey: "return.status.completed",
    icon: Check,
    color: "var(--success)",
    bg: "var(--success-light)",
  },
  DISPUTED: {
    labelKey: "return.status.disputed",
    icon: AlertCircle,
    color: "var(--returned)",
    bg: "var(--returned-light)",
  },
};

const STATUS_ORDER: ReturnStatus[] = ["REQUESTED", "APPROVED", "REJECTED", "COMPLETED", "DISPUTED"];

function ReturnTimeline({ status }: { status: ReturnStatus }) {
  const { t } = useTranslation();
  const currentIndex = STATUS_ORDER.indexOf(status);

  return (
    <div className="flex items-center justify-between">
      {STATUS_ORDER.map((s, index) => {
        const isPast = index < currentIndex;
        const isCurrent = s === status;
        const config = STATUS_CONFIG[s];

        return (
          <div key={s} className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                isPast || isCurrent ? "" : "bg-muted"
              }`}
              style={{
                background: isPast || isCurrent ? config.bg : "var(--muted)",
              }}
              aria-hidden="true"
            >
              {isPast ? (
                <Check size={16} style={{ color: config.color }} />
              ) : isCurrent ? (
                <config.icon size={16} style={{ color: config.color }} />
              ) : (
                <div className="w-2 h-2 rounded-full bg-muted-foreground" />
              )}
            </div>
            <span
              className={`text-[10px] mt-1 text-center ${
                isCurrent ? "font-semibold" : "text-muted-foreground"
              }`}
              style={{ color: isCurrent ? config.color : undefined }}
            >
              {t(config.labelKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReturnDetailModal({ returnId, onClose }: { returnId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const returnQuery = useQuery({
    queryKey: ["returns", returnId],
    queryFn: () => getReturn(returnId),
    enabled: !!returnId,
  });

  const disputeMutation = useMutation({
    mutationFn: (buyerReason: string) => openDispute(returnId, { buyerReason }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["returns"] });
      toast.success(t("return.dispute.success"));
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : t("return.dispute.error");
      toast.error(message);
    },
  });

  const ret = returnQuery.data;

  const [disputeReason, setDisputeReason] = useState("");

  const handleDispute = useCallback(() => {
    if (disputeReason.trim().length < 10) {
      toast.error(t("return.dispute.reasonTooShort"));
      return;
    }
    disputeMutation.mutate(disputeReason);
  }, [disputeReason, disputeMutation, t]);

  return (
    <Modal open onClose={onClose} title={t("return.detail.title")} subtitle={returnId}>
      {returnQuery.isLoading ? (
        <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>
      ) : ret ? (
        <>
          {/* Status Timeline */}
          <div className="mb-6 pb-6 border-b border-border">
            <ReturnTimeline status={ret.status} />
          </div>

          {/* Return Details */}
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t("return.detail.orderId")}</span>
              <span className="text-sm font-medium font-mono">
                {ret.orderId?.slice(0, 8).toUpperCase()}
              </span>
            </div>

            {ret.reason ? (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{t("return.detail.reason")}</span>
                <span className="text-sm font-medium">{ret.reason}</span>
              </div>
            ) : null}

            {ret.refundAmount !== undefined ? (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("return.detail.refundAmount")}
                </span>
                <span className="text-sm font-bold text-primary">
                  {formatPrice(ret.refundAmount)}
                </span>
              </div>
            ) : null}

            {ret.createdAt ? (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {t("return.detail.requestedAt")}
                </span>
                <span className="text-sm">{new Date(ret.createdAt).toLocaleDateString()}</span>
              </div>
            ) : null}
          </div>

          {/* Dispute Section - Only for REQUESTED or REJECTED */}
          {ret.status === "REQUESTED" || ret.status === "REJECTED" ? (
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="text-sm font-semibold mb-3">{t("return.dispute.title")}</h4>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t("return.dispute.placeholder")}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:border-[var(--primary)] resize-none"
              />
              <button
                onClick={handleDispute}
                disabled={disputeMutation.isPending}
                className="mt-3 w-full py-2 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium hover:bg-amber-200 disabled:opacity-50"
              >
                {disputeMutation.isPending
                  ? t("return.dispute.submitting")
                  : t("return.dispute.submit")}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="py-8 text-center text-muted-foreground">{t("return.detail.notFound")}</div>
      )}
    </Modal>
  );
}

function ReturnCard({ returnItem }: { returnItem: Return }) {
  const { t } = useTranslation();
  const [showDetail, setShowDetail] = useState(false);

  const config = STATUS_CONFIG[returnItem.status];

  return (
    <>
      {showDetail ? (
        <ReturnDetailModal returnId={returnItem.id} onClose={() => setShowDetail(false)} />
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card border border-border rounded-[var(--radius-lg)] p-5 mb-3 transition-all hover:border-border-hover hover:shadow-sm cursor-pointer"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">
              #{returnItem.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: config.bg, color: config.color }}
          >
            <config.icon size={12} />
            {t(config.labelKey)}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium font-mono">
              {returnItem.orderId?.slice(0, 8).toUpperCase()}
            </span>
          </div>
          {returnItem.refundAmount !== undefined ? (
            <span className="text-sm font-bold text-primary">
              {formatPrice(returnItem.refundAmount)}
            </span>
          ) : null}
        </div>

        {returnItem.reason ? (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{returnItem.reason}</p>
        ) : null}

        <div className="mt-4 pt-3 border-t border-border">
          <ReturnTimeline status={returnItem.status} />
        </div>
      </motion.div>
    </>
  );
}

export function ReturnStatusPage() {
  const { t } = useTranslation();

  const returnsQuery = useQuery({
    queryKey: ["returns"],
    queryFn: listReturns,
  });

  const returns = returnsQuery.data ?? [];

  if (returnsQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (returnsQuery.isError) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 text-center">
        <AlertCircle size={48} className="mx-auto mb-4 text-error" />
        <p className="text-muted-foreground mb-4">{t("return.status.loadError")}</p>
        <button
          onClick={() => returnsQuery.refetch()}
          className="px-4 py-2 rounded-lg border border-border hover:bg-muted"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/orders"
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          aria-label={t("return.request.backToOrders")}
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-foreground">{t("return.status.title")}</h1>
      </div>

      <AccountNav />

      {returns.length > 0 ? (
        <div>
          {returns.map((ret) => (
            <ReturnCard key={ret.id} returnItem={ret} />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center bg-card rounded-[var(--radius-lg)] border border-border">
          <Package size={48} className="mx-auto mb-4 text-gray-200" />
          <p className="text-muted-foreground font-medium">{t("return.status.empty")}</p>
          <Link
            to="/orders"
            className="mt-4 inline-block px-4 py-2 rounded-lg text-sm font-medium text-primary hover:underline"
          >
            {t("return.status.viewOrders")}
          </Link>
        </div>
      )}
    </div>
  );
}

export function ReturnStatusPageWrapper() {
  return <ReturnStatusPage />;
}

export default ReturnStatusPageWrapper;
