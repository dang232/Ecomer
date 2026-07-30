import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { toWalletView, WalletPage } from "@/features/seller-finance";
import { ApiError } from "@/shared/api";
import { type Payout, requestPayout } from "@/shared/api/endpoints/seller-finance";

// Re-export the presenter so consumers can transform raw data.
// eslint-disable-next-line react-refresh/only-export-components
export { toWalletView };

/**
 * SellerWallet — thin wrapper that converts legacy `balance`/`payouts` props into
 * a WalletView and delegates all rendering to the feature component.
 *
 * Idempotency key is NOT cleared on network/server failure — it is cleared only
 * on success or explicit dialog close/reset, matching the feature contract.
 */
export function SellerWallet({
  balance,
  payouts,
  error,
}: {
  balance: number | null;
  payouts: Payout[];
  isLoading: boolean;
  error: unknown;
}) {
  const qc = useQueryClient();
  const { t } = useTranslation();

  // Stable ref — NOT cleared on network/server error; cleared on success or
  // explicit dialog close so a retry uses the same idempotency key.
  const idempotencyKeyRef = useRef<string | null>(null);

  const requestPayoutMutation = useMutation({
    mutationFn: (body: { amount: number; currency: string }) => {
      const key = idempotencyKeyRef.current ?? crypto.randomUUID();
      idempotencyKeyRef.current = key;
      return requestPayout(body, key);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "wallet"] });
      void qc.invalidateQueries({ queryKey: ["seller", "payouts"] });
      toast.success(t("seller.wallet.payoutOk"));
      idempotencyKeyRef.current = null;
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.wallet.payoutErr")),
  });

  const wallet = {
    balance: balance ?? 0,
    pending: 0,
  };
  const view = toWalletView({ wallet, payouts });

  const handleRequestPayout = (
    body: { amount: number; currency: string },
    _idempotencyKey: string, // consumed by caller
  ) => {
    requestPayoutMutation.mutate(body);
  };

  return (
    <>
      {error instanceof ApiError ? (
        <p className="text-sm text-red-500 mb-3">
          {t("seller.wallet.loadError", { message: error.message })}
        </p>
      ) : null}
      <WalletPage view={view} onRequestPayout={handleRequestPayout} />
    </>
  );
}
