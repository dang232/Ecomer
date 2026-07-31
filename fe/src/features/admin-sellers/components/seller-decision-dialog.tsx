import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Modal } from "@/shared/ui/modal";

const rejectSchema = z.object({
  reason: z.string().trim().min(1),
});

interface SellerDecisionDialogProps {
  variant: "approve" | "reject";
  sellerId: string;
  shopName?: string | null;
  onConfirm: (input: { reason?: string }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function SellerDecisionDialog({
  variant,
  sellerId,
  shopName,
  onConfirm,
  onCancel,
  isPending,
}: SellerDecisionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (variant === "reject") {
      const result = rejectSchema.safeParse({ reason });
      if (!result.success) {
        setFieldError(t("admin.queue.reasonRequired") ?? "Reason is required");
        return;
      }
      onConfirm({ reason: result.data.reason });
      return;
    }
    onConfirm({});
  };

  if (variant === "approve") {
    return (
      <Modal
        open
        onClose={onCancel}
        dismissDisabled={isPending}
        title={t("admin.sellers.applicationDialog.approve") ?? "Approve seller"}
        subtitle={shopName ?? sellerId}
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
              style={{ background: "var(--primary)" }}
            >
              {isPending
                ? (t("common.submitting") ?? "Submitting...")
                : (t("admin.sellers.approve") ?? "Approve")}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          {shopName ? `${shopName} — ${sellerId}` : sellerId}
        </p>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onCancel}
      dismissDisabled={isPending}
      title={t("admin.sellers.rejectDialog.title") ?? "Reject seller"}
      subtitle={shopName ?? sellerId}
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
            {isPending
              ? (t("common.submitting") ?? "Submitting...")
              : (t("admin.sellers.rejectDialog.submitLabel") ?? "Reject")}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="seller-reject-reason" className="block text-sm font-semibold mb-1.5">
          {t("admin.sellers.rejectDialog.reasonLabel") ?? "Reason"}
        </label>
        <textarea
          id="seller-reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder={t("admin.sellers.rejectDialog.reasonPlaceholder") ?? "Reason"}
        />
        {fieldError ? <p className="mt-1 text-xs text-red-500">{fieldError}</p> : null}
      </div>
    </Modal>
  );
}