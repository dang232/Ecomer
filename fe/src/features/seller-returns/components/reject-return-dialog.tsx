import { useTranslation } from "react-i18next";

import { FormDialog } from "@/shared/ui";

interface RejectReturnDialogProps {
  returnId: string | null;
  isPending: boolean;
  onClose: () => void;
  onReject: (returnId: string) => void;
}

/** Confirmation dialog for a rejection request that has no request body. */
export function RejectReturnDialog({
  returnId,
  isPending,
  onClose,
  onReject,
}: RejectReturnDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={!!returnId}
      title={t("seller.rejectDialog.title")}
      description={returnId ? t("seller.rejectDialog.subtitle", { id: returnId }) : undefined}
      submitLabel={t("seller.rejectDialog.submitLabel")}
      submitColor="var(--error)"
      fields={[]}
      onClose={onClose}
      onSubmit={() => {
        if (returnId) onReject(returnId);
      }}
      isSubmitting={isPending}
    />
  );
}
