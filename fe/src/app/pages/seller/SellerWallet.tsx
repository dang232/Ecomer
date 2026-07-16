import { IconWalletOff } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { StatusPill } from "../../components/status-pill";
import { ApiError } from "../../lib/api";
import { requestPayout, type Payout } from "../../lib/api/endpoints/seller-finance";
import { formatDate, formatPrice } from "../../lib/format";
import { groupByDate } from "../../lib/group-by-date";

/** Known withdrawal statuses the BE may return. Maps the `filter` chip
 *  ("all" | "completed" | "pending" | "failed") to the corresponding
 *  status substrings so the filter works reliably regardless of how the
 *  BE capitalises or prefixes the enum values. */
const WITHDRAWAL_STATUS_FILTER: Record<"all" | "completed" | "pending" | "failed", Set<string>> = {
  all: new Set(),
  completed: new Set(["COMPLETED", "PAID"]),
  pending: new Set(["PENDING"]),
  failed: new Set(["FAILED", "REJECTED"]),
};

export function SellerWallet({
  balance,
  payouts,
  isLoading,
  error,
}: {
  balance: number | null;
  payouts: Payout[];
  isLoading: boolean;
  error: unknown;
}) {
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [filter, setFilter] = useState<"all" | "completed" | "pending" | "failed">("all");
  const requestPayoutMutation = useMutation({
    mutationFn: (body: { amount: number; bankAccount: string }) => requestPayout(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller", "wallet"] });
      void qc.invalidateQueries({ queryKey: ["seller", "payouts"] });
      toast.success(t("seller.wallet.payoutOk"));
      setShowPayoutDialog(false);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("seller.wallet.payoutErr")),
  });

  const filteredPayouts = useMemo(() => {
    const matchSet = WITHDRAWAL_STATUS_FILTER[filter];
    if (matchSet.size === 0) return payouts;
    return payouts.filter((p) => {
      const upper = p.status.toUpperCase();
      return [...matchSet].some((s) => upper.includes(s));
    });
  }, [payouts, filter]);

  const sections = useMemo(
    () => groupByDate(filteredPayouts, (p) => p.requestedAt, i18n.language),
    [filteredPayouts, i18n.language],
  );

  return (
    <div className="space-y-5">
      <FormDialog
        open={showPayoutDialog}
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
            required: true,
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
          {
            key: "bankAccount",
            label: t("seller.wallet.payoutDialog.bankLabel"),
            placeholder: t("seller.wallet.payoutDialog.bankPlaceholder"),
            required: true,
            validate: (v) => {
              if (!/^\d{6,19}$/.test(v.trim())) return "Bank account must be 6-19 digits";
              return undefined;
            },
          },
        ]}
        onClose={() => setShowPayoutDialog(false)}
        onSubmit={({ amount, bankAccount }) => {
          const parsed = Number(amount.replace(/\D/g, ""));
          requestPayoutMutation.mutate({ amount: parsed, bankAccount });
        }}
        isSubmitting={requestPayoutMutation.isPending}
      />
      <h2 className="text-xl font-bold text-foreground">{t("seller.wallet.title")}</h2>

      <div
        className="rounded-2xl p-6 text-white"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-dark))" }}
      >
        <p className="text-white/70 text-sm mb-2">{t("seller.wallet.balanceLabel")}</p>
        <p className="text-4xl font-black mb-4">
          {balance !== null
            ? formatPrice(balance)
            : isLoading
              ? t("seller.wallet.loading")
              : t("common.unavailable", { defaultValue: "—" })}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPayoutDialog(true)}
            disabled={requestPayoutMutation.isPending || balance === null || balance <= 0}
            className="px-5 py-2.5 rounded-xl bg-white/20 font-semibold text-sm hover:bg-white/30 transition-colors disabled:opacity-50"
          >
            {requestPayoutMutation.isPending
              ? t("seller.wallet.withdrawing")
              : t("seller.wallet.withdraw")}
          </button>
        </div>
      </div>

      {error instanceof ApiError ? (
        <p className="text-sm text-red-500">
          {t("seller.wallet.loadError", { message: error.message })}
        </p>
      ) : null}

      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-border">
          <h3 className="font-bold text-foreground">{t("seller.wallet.historyTitle")}</h3>
          <div className="flex items-center gap-1.5">
            {(["all", "completed", "pending", "failed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors"
                style={{
                  background: filter === f ? "rgb(var(--primary-light-rgb) / 0.12)" : "transparent",
                  color: filter === f ? "var(--primary)" : "var(--muted-foreground)",
                  border: filter === f ? "1px solid var(--primary)" : "1px solid transparent",
                }}
              >
                {t(`seller.wallet.historyFilter.${f}`)}
              </button>
            ))}
          </div>
        </div>
        {filteredPayouts.length === 0 ? (
          <div className="py-10 text-center">
            <IconWalletOff size={40} className="mx-auto mb-3 text-gray-200" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("seller.wallet.historyEmpty")}</p>
          </div>
        ) : null}
        <div className="divide-y divide-gray-50">
          {sections.map((section) => (
            <div key={section.key}>
              <div className="px-5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground bg-muted/40">
                {t(section.labelKey, section.labelArgs)}
              </div>
              {section.items.map((p) => (
                <div
                  key={p.id}
                  className="px-5 py-4 flex items-center justify-between border-t border-gray-50 first:border-t-0"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatPrice(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.requestedAt
                        ? formatDate(p.requestedAt)
                        : t("common.unavailable", { defaultValue: "—" })}
                    </p>
                  </div>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
