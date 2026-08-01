/**
 * SellerWalletRoute — Plan 07 direct-route adapter.
 * Bridges the `/seller/wallet` route to the feature component.
 * Derives wallet data and idempotency key from scratch (same as legacy SellerWallet wrapper).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { toWalletView, WalletPage } from "@/features/seller-finance";
import { ApiError } from "@/shared/api";
import { myPayouts, myWallet, requestPayout } from "@/shared/api/endpoints/seller-finance";

export function SellerWalletRoute() {
  const qc = useQueryClient();
  const { t } = useTranslation();

  const idempotencyKeyRef = useRef<string | null>(null);

  const walletQuery = useQuery({
    queryKey: ["seller", "wallet"],
    queryFn: myWallet,
    retry: false,
  });

  const payoutsQuery = useQuery({
    queryKey: ["seller", "payouts"],
    queryFn: myPayouts,
    retry: false,
  });

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
    balance: walletQuery.data?.balance ?? 0,
    pending: 0,
  };
  const view = toWalletView({ wallet, payouts: payoutsQuery.data ?? [] });

  const handleRequestPayout = (body: { amount: number; currency: string }) => {
    requestPayoutMutation.mutate(body);
  };

  return (
    <>
      {walletQuery.error instanceof ApiError ? (
        <p className="text-sm text-red-500 mb-3">
          {t("seller.wallet.loadError", { message: walletQuery.error.message })}
        </p>
      ) : null}
      <WalletPage view={view} onRequestPayout={handleRequestPayout} />
    </>
  );
}
