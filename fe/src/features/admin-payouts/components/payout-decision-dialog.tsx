import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Modal } from "@/shared/ui/modal";

export type PayoutDecisionVariant =
  "approve" | "reject" | "submit" | "unknown" | "paid" | "legacy-complete" | "legacy-fail";

export interface PayoutDecisionDialogProps {
  variant: PayoutDecisionVariant;
  payoutId: string;
  sellerLabel: string | null;
  amountLabel: string;
  isPending?: boolean;
  onConfirm: (values: {
    reason: string;
    providerReference?: string;
    attemptId?: string;
    evidence?: string;
    externalReference?: string;
    evidenceHash?: string;
    maskedDestinationConfirmed?: boolean;
  }) => void;
  onCancel: () => void;
}

const REASON_REQUIRED_VARIANTS: ReadonlySet<PayoutDecisionVariant> = new Set([
  "approve",
  "reject",
  "unknown",
  "legacy-complete",
  "legacy-fail",
]);

export function PayoutDecisionDialog({
  variant,
  payoutId,
  sellerLabel,
  amountLabel,
  isPending,
  onConfirm,
  onCancel,
}: PayoutDecisionDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [providerReference, setProviderReference] = useState("");
  const [attemptId, setAttemptId] = useState("");
  const [evidence, setEvidence] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [evidenceHash, setEvidenceHash] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleConfirm = () => {
    const trimmedReason = reason.trim();
    if (REASON_REQUIRED_VARIANTS.has(variant) && !trimmedReason) {
      setFieldError(t("admin.queue.reasonRequired") ?? "Reason is required");
      return;
    }
    if ((variant === "submit" || variant === "paid") && !providerReference.trim()) {
      setFieldError(
        t("admin.payouts.providerReferenceRequired") ?? "Provider reference is required",
      );
      return;
    }
    if (variant === "submit" && !attemptId.trim()) {
      setFieldError(t("admin.payouts.attemptIdRequired") ?? "Attempt id is required");
      return;
    }
    if (variant === "paid" && !evidence.trim()) {
      setFieldError(t("admin.payouts.evidenceRequired") ?? "Evidence is required");
      return;
    }
    if (variant === "legacy-complete") {
      if (!externalReference.trim() || !evidenceHash.trim()) {
        setFieldError(
          t("admin.payouts.legacyCompleteRequired") ??
            "External reference and evidence hash are required",
        );
        return;
      }
    }
    if (variant === "legacy-fail") {
      if (!externalReference.trim() && !evidenceHash.trim()) {
        setFieldError(
          t("admin.payouts.legacyFailAtLeastOne") ??
            "At least one of external reference or evidence hash is required",
        );
        return;
      }
    }

    onConfirm({
      reason: trimmedReason,
      providerReference: providerReference.trim() || undefined,
      attemptId: attemptId.trim() || undefined,
      evidence: evidence.trim() || undefined,
      externalReference: externalReference.trim() || undefined,
      evidenceHash: evidenceHash.trim() || undefined,
      maskedDestinationConfirmed: variant === "legacy-complete" ? true : undefined,
    });
    setReason("");
    setProviderReference("");
    setAttemptId("");
    setEvidence("");
    setExternalReference("");
    setEvidenceHash("");
  };

  const title = t(`admin.payouts.dialogs.${variant}.title`, {
    defaultValue: variantTitle(variant),
  });
  const subtitle = t("admin.payouts.dialogs.subtitle", {
    id: payoutId,
    amount: amountLabel,
    seller: sellerLabel ?? "—",
    defaultValue: `${payoutId} · ${amountLabel}`,
  });
  const submitLabel = t(`admin.payouts.dialogs.${variant}.submit`, {
    defaultValue: t("common.confirm") ?? "Confirm",
  });

  return (
    <Modal
      open
      onClose={onCancel}
      dismissDisabled={isPending}
      title={title}
      subtitle={subtitle}
      footer={
        <>
          <button
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("common.cancel") ?? "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isPending ? (t("common.submitting") ?? "Submitting...") : submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <ReasonField variant={variant} value={reason} onChange={setReason} t={t} />
        {variant === "submit" || variant === "paid" ? (
          <TextField
            id="provider-reference"
            label={t("admin.payouts.fields.providerReference") ?? "Provider reference"}
            value={providerReference}
            onChange={setProviderReference}
            placeholder={t("admin.payouts.fields.providerReferencePlaceholder") ?? "BANK-12345"}
          />
        ) : null}
        {variant === "submit" ? (
          <TextField
            id="attempt-id"
            label={t("admin.payouts.fields.attemptId") ?? "Attempt id"}
            value={attemptId}
            onChange={setAttemptId}
            placeholder={t("admin.payouts.fields.attemptIdPlaceholder") ?? "attempt-001"}
          />
        ) : null}
        {variant === "paid" ? (
          <TextField
            id="evidence"
            label={t("admin.payouts.fields.evidence") ?? "Evidence"}
            value={evidence}
            onChange={setEvidence}
            placeholder={t("admin.payouts.fields.evidencePlaceholder") ?? "screenshot reference"}
          />
        ) : null}
        {variant === "legacy-complete" || variant === "legacy-fail" ? (
          <>
            <TextField
              id="external-reference"
              label={t("admin.payouts.fields.externalReference") ?? "External reference"}
              value={externalReference}
              onChange={setExternalReference}
              placeholder={t("admin.payouts.fields.externalReferencePlaceholder") ?? "Bank ref"}
            />
            <TextField
              id="evidence-hash"
              label={t("admin.payouts.fields.evidenceHash") ?? "Evidence hash"}
              value={evidenceHash}
              onChange={setEvidenceHash}
              placeholder={t("admin.payouts.fields.evidenceHashPlaceholder") ?? "sha256:..."}
            />
            {variant === "legacy-complete" ? (
              <p className="text-xs text-muted-foreground">
                {t("admin.payouts.fields.maskedDestinationAuto") ??
                  "Masked destination confirmation is required and implied by this action."}
              </p>
            ) : null}
          </>
        ) : null}
        {fieldError ? <p className="text-xs text-red-500">{fieldError}</p> : null}
      </div>
    </Modal>
  );
}

function variantTitle(v: PayoutDecisionVariant): string {
  switch (v) {
    case "approve":
      return "Approve payout";
    case "reject":
      return "Reject payout";
    case "submit":
      return "Submit payout";
    case "unknown":
      return "Mark as unknown";
    case "paid":
      return "Mark as paid";
    case "legacy-complete":
      return "Complete legacy payout";
    case "legacy-fail":
      return "Fail legacy payout";
  }
}

interface ReasonFieldProps {
  variant: PayoutDecisionVariant;
  value: string;
  onChange: (v: string) => void;
  t: (key: string, opts?: { defaultValue?: string }) => string;
}

function ReasonField({ variant, value, onChange, t }: ReasonFieldProps) {
  if (variant === "submit" || variant === "paid") {
    return (
      <TextField
        id="payout-reason"
        label={t("admin.payouts.fields.reasonOptional") ?? "Reason (optional)"}
        value={value}
        onChange={onChange}
        placeholder={t("admin.payouts.fields.reasonPlaceholder") ?? "Bank name, attempt #, ..."}
      />
    );
  }
  return (
    <div>
      <label htmlFor="payout-reason" className="mb-1.5 block text-sm font-semibold">
        {t("admin.payouts.fields.reason") ?? "Reason"}
      </label>
      <textarea
        id="payout-reason"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
        placeholder={t("admin.payouts.fields.reasonPlaceholder") ?? "Reason for action..."}
      />
    </div>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

function TextField({ id, label, value, onChange, placeholder }: TextFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}
