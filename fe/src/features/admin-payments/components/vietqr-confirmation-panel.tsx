import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ApiError } from "@/shared/api";
import { adminConfirmVietQr } from "@/shared/api/endpoints/admin";

import {
  buildVietqrConfirmationPayload,
  vietqrConfirmationSchema,
} from "../model/vietqr-confirmation";

export interface VietqrConfirmationPanelProps {
  paymentId: string;
  onConfirmed?: (bankReference: string | undefined) => void;
}

export function VietqrConfirmationPanel({ paymentId, onConfirmed }: VietqrConfirmationPanelProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [bankReference, setBankReference] = useState("");
  const [error, setError] = useState<string | null>(null);

  const confirm = useMutation({
    mutationFn: async () => {
      const parsed = vietqrConfirmationSchema.parse({
        paymentId,
        bankReference: bankReference.trim() || undefined,
      });
      const payload = buildVietqrConfirmationPayload(parsed.bankReference);
      await adminConfirmVietQr(parsed.paymentId, payload);
      return parsed;
    },
    onSuccess: (parsed) => {
      void qc.invalidateQueries({ queryKey: ["admin", "payments"] });
      toast.success(t("admin.payments.vietqr.confirmOk") ?? "VietQR payment confirmed");
      setBankReference("");
      setError(null);
      onConfirmed?.(parsed.bankReference);
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : String(err);
      setError(message);
      toast.error(message);
    },
  });

  const handleConfirm = () => {
    setError(null);
    const result = vietqrConfirmationSchema.safeParse({
      paymentId,
      bankReference: bankReference.trim() || undefined,
    });
    if (!result.success) {
      const issue = result.error.issues[0];
      setError(issue?.message ?? "Invalid input");
      return;
    }
    confirm.mutate();
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          {t("admin.payments.vietqr.panelTitle") ?? "Confirm VietQR payment"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t("admin.payments.vietqr.panelSubtitle", {
            paymentId,
            defaultValue: `Payment: ${paymentId}`,
          })}
        </p>
      </div>

      <div>
        <label htmlFor="vietqr-bank-reference" className="mb-1.5 block text-sm font-semibold">
          {t("admin.payments.vietqr.bankReference") ?? "Bank reference (optional)"}
        </label>
        <input
          id="vietqr-bank-reference"
          type="text"
          value={bankReference}
          onChange={(e) => setBankReference(e.target.value)}
          placeholder={
            t("admin.payments.vietqr.bankReferencePlaceholder") ??
            "BANK-12345 — leave blank to auto-generate"
          }
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t("admin.payments.vietqr.bankReferenceHelp", {
            defaultValue:
              "If the buyer provided a bank reference (often the payment id), paste it here. Otherwise the BE assigns a synthetic VIETQR-MANUAL-* reference.",
          })}
        </p>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirm.isPending}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {confirm.isPending
            ? (t("common.submitting") ?? "Submitting...")
            : (t("admin.payments.vietqr.confirm") ?? "Confirm payment")}
        </button>
      </div>
    </div>
  );
}
