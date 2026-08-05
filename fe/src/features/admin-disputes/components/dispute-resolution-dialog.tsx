import { useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { Modal } from "@/shared/ui/modal";

const resolutionSchema = z.object({
  adminResolution: z.string().trim().min(1),
});

interface DisputeResolutionDialogProps {
  disputeId: string;
  onConfirm: (input: { adminResolution: string }) => void;
  onCancel: () => void;
  isPending?: boolean;
}

export function DisputeResolutionDialog({
  disputeId,
  onConfirm,
  onCancel,
  isPending,
}: DisputeResolutionDialogProps) {
  const { t } = useTranslation();
  const [resolution, setResolution] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleConfirm = () => {
    const result = resolutionSchema.safeParse({ adminResolution: resolution });
    if (!result.success) {
      setFieldError(t("admin.queue.reasonRequired") ?? "Reason is required");
      return;
    }
    onConfirm({ adminResolution: result.data.adminResolution });
  };

  return (
    <Modal
      open
      onClose={onCancel}
      dismissDisabled={isPending}
      title={t("admin.disputes.resolveDialog.title") ?? "Resolve dispute"}
      subtitle={disputeId}
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
              : (t("admin.disputes.resolveDialog.submit") ?? "Submit")}
          </button>
        </>
      }
    >
      <div>
        <label htmlFor="dispute-resolution" className="block text-sm font-semibold mb-1.5">
          {t("admin.disputes.resolveDialog.resolutionLabel") ?? "Resolution"}
        </label>
        <textarea
          id="dispute-resolution"
          value={resolution}
          onChange={(e) => setResolution(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          placeholder={t("admin.disputes.resolveDialog.resolutionPlaceholder") ?? "Resolution"}
        />
        {fieldError ? <p className="mt-1 text-xs text-red-500">{fieldError}</p> : null}
      </div>
    </Modal>
  );
}
