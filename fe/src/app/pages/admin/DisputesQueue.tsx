import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { FormDialog } from "../../components/form-dialog";
import { ApiError } from "../../lib/api";
import { adminOpenDisputes, adminResolveDispute } from "../../lib/api/endpoints/admin";

export function DisputesQueue() {
  const qc = useQueryClient();
  const { t } = useTranslation();
  const [resolveFor, setResolveFor] = useState<string | null>(null);
  const disputesQuery = useQuery({
    queryKey: ["admin", "disputes"],
    queryFn: adminOpenDisputes,
    retry: false,
  });

  const resolve = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { resolution: string; refundAmount?: number };
    }) => adminResolveDispute(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
      toast.success(t("admin.disputes.resolveOk"));
      setResolveFor(null);
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : t("admin.disputes.resolveErr")),
  });

  const disputes = disputesQuery.data ?? [];

  return (
    <div className="space-y-5">
      <FormDialog
        open={!!resolveFor}
        title={t("admin.disputes.resolveDialog.title")}
        description={
          resolveFor ? t("admin.disputes.resolveDialog.subtitle", { id: resolveFor }) : undefined
        }
        submitLabel={t("admin.disputes.resolveDialog.submit")}
        submitColor="var(--primary)"
        fields={[
          {
            key: "resolution",
            label: t("admin.disputes.resolveDialog.resolutionLabel"),
            placeholder: t("admin.disputes.resolveDialog.resolutionPlaceholder"),
            type: "textarea",
            required: true,
          },
          {
            key: "refundAmount",
            label: t("admin.disputes.resolveDialog.refundLabel"),
            placeholder: t("admin.disputes.resolveDialog.refundPlaceholder"),
            type: "number",
            required: false,
            helper: t("admin.disputes.resolveDialog.refundHelper"),
          },
        ]}
        onClose={() => setResolveFor(null)}
        onSubmit={({ resolution, refundAmount }) => {
          if (!resolveFor) return;
          const body: { resolution: string; refundAmount?: number } = { resolution };
          if (refundAmount) {
            const parsed = Number(refundAmount.replace(/\D/g, ""));
            if (parsed > 0) body.refundAmount = parsed;
          }
          resolve.mutate({ id: resolveFor, body });
        }}
        isSubmitting={resolve.isPending}
      />
      <h2 className="text-xl font-bold text-foreground">{t("admin.disputes.title")}</h2>

      {disputesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.disputes.loading")}</p>
      ) : null}
      {!disputesQuery.isLoading && disputes.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("admin.disputes.empty")}</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {disputes.map((d) => (
          <div key={d.id} className="bg-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-mono text-muted-foreground">{d.id}</p>
                <p className="text-sm font-semibold text-foreground">
                  {t("admin.disputes.orderLabel", { id: d.returnId })}
                </p>
                <p className="text-xs text-muted-foreground">{d.createdAt ?? ""}</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                {d.status}
              </span>
            </div>
            {d.description ? (
              <p className="text-sm text-foreground mb-3 bg-muted p-3 rounded-xl">
                {d.description}
              </p>
            ) : null}
            <button
              onClick={() => setResolveFor(d.id)}
              disabled={resolve.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              {t("admin.disputes.resolve")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
