import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Modal } from "@/shared/ui/modal";

import { ADMIN_SETTABLE_ORDER_STATUSES } from "../model/order-view";

const refundSchema = z.object({
  reason: z.string().min(1),
});

const changeStatusSchema = z.object({
  status: z.enum(ADMIN_SETTABLE_ORDER_STATUSES),
});

interface DecisionDialogProps {
  variant: "cancel" | "refund" | "change-status";
  orderId: string;
  orderNumber?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function OrderDecisionDialog({
  variant,
  orderId,
  orderNumber,
  onConfirm,
  onCancel,
  isPending,
}: DecisionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>(ADMIN_SETTABLE_ORDER_STATUSES[0]);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleConfirm = () => {
    setFieldError(null);
    if (variant === "refund") {
      const result = refundSchema.safeParse({ reason: reason.trim() });
      if (!result.success) {
        setFieldError(t("admin.queue.reasonRequired") ?? "Reason is required");
        return;
      }
    }
    if (variant === "change-status") {
      const result = changeStatusSchema.safeParse({ status: selectedStatus });
      if (!result.success) {
        setFieldError("Invalid status");
        return;
      }
    }
    onConfirm();
    setReason("");
  };

  if (variant === "cancel") {
    return (
      <Modal
        open
        onClose={onCancel}
        dismissDisabled={isPending}
        title={t("admin.orders.cancelConfirmTitle") ?? "Cancel order?"}
        subtitle={`${orderNumber ?? orderId}`}
        footer={
          <>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? (t("common.submitting") ?? "Submitting...") : (t("admin.orders.cancel") ?? "Cancel")}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {t("admin.orders.cancelConfirmDescription") ?? "This action cannot be undone."}
        </p>
      </Modal>
    );
  }

  if (variant === "refund") {
    return (
      <Modal
        open
        onClose={onCancel}
        dismissDisabled={isPending}
        title={t("admin.orders.refundConfirmTitle") ?? "Issue refund?"}
        subtitle={`${orderNumber ?? orderId}`}
        footer={
          <>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? (t("common.submitting") ?? "Submitting...") : (t("admin.orders.refundConfirmBtn") ?? "Refund")}
            </button>
          </>
        }
      >
        <div>
          <label htmlFor="refund-reason" className="block text-sm font-semibold mb-1.5">
            {t("admin.orders.reasonLabel") ?? "Reason"}
          </label>
          <textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            placeholder={t("admin.orders.reasonPlaceholder") ?? "Enter refund reason..."}
          />
          {fieldError ? (
            <p className="mt-1 text-xs text-red-500">{fieldError}</p>
          ) : null}
        </div>
      </Modal>
    );
  }

  if (variant === "change-status") {
    return (
      <Modal
        open
        onClose={onCancel}
        dismissDisabled={isPending}
        title={t("admin.orders.changeStatusTitle") ?? "Change status"}
        subtitle={`${orderNumber ?? orderId}`}
        footer={
          <>
            <button
              onClick={onCancel}
              disabled={isPending}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isPending}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--admin-primary)" }}
            >
              {isPending ? (t("common.submitting") ?? "Submitting...") : (t("common.confirm") ?? "Confirm")}
            </button>
          </>
        }
      >
        <div>
          <label htmlFor="order-status" className="block text-sm font-semibold mb-1.5">
            {t("admin.orders.newStatus") ?? "New status"}
          </label>
          <select
            id="order-status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {ADMIN_SETTABLE_ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </Modal>
    );
  }

  return null;
}
