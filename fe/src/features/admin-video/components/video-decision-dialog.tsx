import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Modal } from "@/shared/ui/modal";

const reasonSchema = z.object({
  reason: z.string().trim().min(1),
});

interface VideoDecisionDialogProps {
  /** "reject" for moderation, "reject-appeal" for appeals. */
  variant: "reject" | "reject-appeal";
  videoId: string;
  onConfirm: (input: { reason: string }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

/**
 * Single decision dialog used by both the moderation queue (reject) and the
 * appeals queue (reject-appeal). Variants differ only in copy.
 */
export function VideoDecisionDialog({
  variant,
  videoId,
  onConfirm,
  onCancel,
  isPending,
}: VideoDecisionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const titleKey =
    variant === "reject"
      ? (t("admin.videoModeration.rejectDialog.title") ?? "Reject Video")
      : (t("admin.videoAppeals.rejectDialog.title") ?? "Reject Appeal");
  const placeholderKey =
    variant === "reject"
      ? (t("admin.videoModeration.rejectDialog.reasonPlaceholder") ?? "Reason")
      : (t("admin.videoAppeals.rejectDialog.reasonPlaceholder") ?? "Reason");
  const submitKey =
    variant === "reject"
      ? (t("admin.videoModeration.rejectDialog.submit") ?? "Reject")
      : (t("admin.videoAppeals.rejectDialog.submit") ?? "Reject");

  const handleConfirm = () => {
    const result = reasonSchema.safeParse({ reason });
    if (!result.success) {
      setFieldError(t("admin.queue.reasonRequired") ?? "Reason is required");
      return;
    }
    onConfirm({ reason: result.data.reason });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      dismissDisabled={isPending}
      title={titleKey}
      subtitle={videoId}
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
            {isPending ? (t("common.submitting") ?? "Submitting...") : submitKey}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="video-reject-reason" className="block text-sm font-semibold mb-1.5">
          {t("admin.queue.reasonLabel") ?? "Reason"}
        </label>
        <textarea
          id="video-reject-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder={placeholderKey}
        />
        {fieldError ? <p className="mt-1 text-xs text-red-500">{fieldError}</p> : null}
      </div>
    </Modal>
  );
}
