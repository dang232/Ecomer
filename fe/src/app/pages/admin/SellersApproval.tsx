import { IconCircleCheck, IconEye, IconSearch, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { ApiError } from "../../lib/api";
import {
  adminApproveSeller,
  adminListSellers,
  adminRejectSeller,
} from "../../lib/api/endpoints/admin";
import { formatRelativeTime } from "../../lib/format";

import { SellerApplicationDetail } from "./SellerApplicationDetail";

export function SellersApproval() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const sellersQuery = useQuery({
    queryKey: ["admin", "sellers"],
    queryFn: adminListSellers,
    retry: false,
  });

  const approve = useMutation({
    mutationFn: (id: string) => adminApproveSeller(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      toast.success(t("admin.sellers.approveOk"));
      setDetailFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.sellers.approveErr")),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      adminRejectSeller(id, { reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "sellers"] });
      toast.success(t("admin.sellers.rejectOk"));
      setRejectFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.sellers.rejectErr")),
  });

  const filtered = (sellersQuery.data ?? []).filter((s) =>
    s.shopName.toLowerCase().includes(search.toLowerCase()),
  );

  const detailSeller = detailFor
    ? ((sellersQuery.data ?? []).find((s) => s.id === detailFor) ?? null)
    : null;

  return (
    <div className="space-y-5">
      <SellerApplicationDetail
        seller={detailSeller}
        onClose={() => setDetailFor(null)}
        onApprove={(id) => approve.mutate(id)}
        isApproving={approve.isPending}
      />
      <FormDialog
        open={!!rejectFor}
        title={t("admin.sellers.rejectDialog.title")}
        description={
          rejectFor ? t("admin.sellers.rejectDialog.subtitle", { id: rejectFor }) : undefined
        }
        submitLabel={t("admin.sellers.rejectDialog.submitLabel")}
        submitColor="var(--error)"
        fields={[
          {
            key: "reason",
            label: t("admin.sellers.rejectDialog.reasonLabel"),
            placeholder: t("admin.sellers.rejectDialog.reasonPlaceholder"),
            type: "textarea",
            required: true,
          },
        ]}
        onClose={() => setRejectFor(null)}
        onSubmit={({ reason }) => {
          if (rejectFor) reject.mutate({ id: rejectFor, reason });
        }}
        isSubmitting={reject.isPending}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{t("admin.sellers.title")}</h2>
      </div>
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-2.5 shadow-sm">
        <IconSearch size={16} className="text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("admin.sellers.searchPlaceholder")}
          className="flex-1 text-sm outline-none"
        />
      </div>

      {sellersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.sellers.loading")}</p>
      ) : null}
      {sellersQuery.error instanceof ApiError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{sellersQuery.error.message}</p>
      ) : null}
      {!sellersQuery.isLoading && filtered.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.sellers.empty")}</p>
        </div>
      ) : null}

      <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-50">
          {filtered.map((s) => {
            const tail = s.bankAccount ? s.bankAccount.slice(-4) : null;
            const bankLine =
              s.bankName && tail
                ? t("admin.sellers.rowBank", { bank: s.bankName, tail })
                : t("admin.sellers.rowBankUnknown");
            const tierLine = s.tier
              ? t("admin.sellers.rowTier", { tier: s.tier })
              : t("admin.sellers.rowTierUnknown");
            const appliedLine = s.appliedAt
              ? t("admin.sellers.rowApplied", { relativeTime: formatRelativeTime(s.appliedAt) })
              : null;
            return (
              <div key={s.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">{s.shopName}</p>
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: s.approved ? "var(--success-light)" : "var(--warning-light)",
                        color: s.approved ? "var(--success)" : "var(--warning)",
                      }}
                    >
                      {s.status}
                    </span>
                    {appliedLine ? (
                      <span className="text-[11px] text-muted-foreground">· {appliedLine}</span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bankLine} · {tierLine}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setDetailFor(s.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground hover:bg-muted"
                  >
                    <IconEye size={13} /> {t("admin.sellers.viewApplication")}
                  </button>
                  {!s.approved ? (
                    <>
                      <button
                        onClick={() => approve.mutate(s.id)}
                        disabled={approve.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ background: "var(--primary)" }}
                      >
                        <IconCircleCheck size={13} /> {t("admin.sellers.approve")}
                      </button>
                      <button
                        onClick={() => setRejectFor(s.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50"
                      >
                        <IconX size={13} /> {t("admin.sellers.reject")}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
