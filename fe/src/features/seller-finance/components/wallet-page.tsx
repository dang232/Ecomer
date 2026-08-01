import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import type { WalletView } from "../model/wallet-view";

import { PayoutDialog } from "./payout-dialog";
import { PayoutHistory } from "./payout-history";

type PayoutFilter = "all" | "active" | "paid" | "failed";

interface WalletPageProps {
  view: WalletView;
  onRequestPayout: (body: { amount: number; currency: string }) => void;
}

/**
 * Wallet page composed from typed presenter output.
 *
 * Filter state is URL-owned via `?filter=all|active|paid|failed` so it survives
 * navigation. Idempotency key is preserved across retries and only cleared on
 * success or explicit dialog close/reset.
 */
export function WalletPage({ view, onRequestPayout }: WalletPageProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const filter = (searchParams.get("filter") ?? "all") as PayoutFilter;

  const handleFilterChange = (next: PayoutFilter) => {
    setSearchParams((prev) => {
      const nextParams = new URLSearchParams(prev);
      if (next === "all") {
        nextParams.delete("filter");
      } else {
        nextParams.set("filter", next);
      }
      return nextParams;
    });
  };

  const handleOpenPayoutDialog = () => {
    setShowPayoutDialog(true);
  };

  const handleClosePayoutDialog = () => {
    setShowPayoutDialog(false);
  };

  const handlePayoutSubmit = (amount: number) => {
    onRequestPayout({ amount, currency: "VND" });
  };

  return (
    <div className="space-y-5">
      <PayoutDialog
        open={showPayoutDialog}
        balance={view.availableVnd}
        isSubmitting={false}
        onClose={handleClosePayoutDialog}
        onSubmit={handlePayoutSubmit}
      />

      <h2 className="text-xl font-bold text-foreground">{t("seller.wallet.title")}</h2>

      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dark))" }}
      >
        <p className="text-white/70 text-sm mb-2">{t("seller.wallet.balanceLabel")}</p>
        <p className="text-4xl font-black mb-4">
          {view.availableVnd !== null
            ? `₫${view.availableVnd.toLocaleString("vi-VN")}`
            : t("common.unavailable")}
        </p>
        {view.pendingBalanceVnd !== null && view.pendingBalanceVnd > 0 ? (
          <p className="text-white/60 text-xs mb-3">
            {t("seller.wallet.pendingHint", {
              amount: `₫${view.pendingBalanceVnd.toLocaleString("vi-VN")}`,
            })}
          </p>
        ) : null}
        <div className="flex gap-3">
          <button
            onClick={handleOpenPayoutDialog}
            disabled={!view.canRequestPayout}
            className="px-5 py-2.5 rounded-xl bg-white/20 font-semibold text-sm hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            {t("seller.wallet.withdraw")}
          </button>
        </div>
      </div>

      <PayoutHistory history={view.history} filter={filter} onFilterChange={handleFilterChange} />
    </div>
  );
}
