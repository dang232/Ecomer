import { useTranslation } from "react-i18next";

import { formatPrice } from "@/shared/lib";
import { FormDialog } from "@/shared/ui";

interface PayoutDialogProps {
  open: boolean;
  balance: number | null;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

/**
 * Payout request dialog.
 *
 * Validation rules:
 *   - Amount must be greater than 0
 *   - Amount must not exceed the available balance
 *
 * NOTE: the idempotency key is NOT cleared on network/server error — it is
 * cleared only on success or explicit dialog close/reset (caller's concern).
 * See wallet-page.tsx for the key management strategy.
 */
export function PayoutDialog({
  open,
  balance,
  isSubmitting,
  onClose,
  onSubmit,
}: PayoutDialogProps) {
  const { t } = useTranslation();

  return (
    <FormDialog
      open={open}
      title={t("seller.wallet.payoutDialog.title")}
      description={
        balance !== null
          ? t("seller.wallet.payoutDialog.balanceHint", { balance: formatPrice(balance) })
          : undefined
      }
      submitLabel={t("seller.wallet.payoutDialog.submit")}
      submitColor="var(--primary)"
      fields={[
        {
          key: "amount",
          label: t("seller.wallet.payoutDialog.amountLabel"),
          placeholder: t("seller.wallet.payoutDialog.amountPlaceholder"),
          type: "number",
          required: false,
          min: 1000,
          max: balance ?? undefined,
          inputMode: "numeric",
          validate: (v) => {
            const n = Number(v.replace(/\D/g, ""));
            if (!n || n <= 0) return t("seller.wallet.payoutDialog.invalidAmount");
            if (balance !== null && n > balance)
              return t("seller.wallet.payoutDialog.exceedsBalance");
            return undefined;
          },
        },
      ]}
      onClose={onClose}
      onSubmit={({ amount }) => {
        const parsed = Number(amount.replace(/\D/g, ""));
        onSubmit(parsed);
      }}
      isSubmitting={isSubmitting}
    />
  );
}
