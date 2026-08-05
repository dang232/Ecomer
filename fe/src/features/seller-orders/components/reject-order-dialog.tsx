import { useTranslation } from "react-i18next";

import { FormDialog } from "@/shared/ui";

interface RejectOrderDialogProps {
  subOrderId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function RejectOrderDialog({
  subOrderId,
  open,
  onClose,
  onConfirm,
  isSubmitting,
}: RejectOrderDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      title={t("seller.orders.rejectDialog.title")}
      description={t("seller.orders.rejectDialog.confirmBody", { id: subOrderId })}
      submitLabel={t("seller.orders.rejectDialog.submitLabel")}
      submitColor="var(--error)"
      fields={[]}
      onClose={onClose}
      onSubmit={onConfirm}
      isSubmitting={isSubmitting}
    />
  );
}
