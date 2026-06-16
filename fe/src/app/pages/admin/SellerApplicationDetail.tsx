import { IconCircleCheck, IconX } from "@tabler/icons-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { useEscapeKey } from "../../hooks/use-escape-key";
import { formatDate, formatRelativeTime } from "../../lib/format";
import type { SellerSummary } from "../../types/api";

interface Props {
  seller: SellerSummary | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  isApproving: boolean;
}

/**
 * Detail modal for the Approve Sellers queue. The list row is intentionally
 * spartan — shop name + bank preview + applied-time — so the admin can scan
 * dozens at a glance. This modal is the "I want to look at this one" surface
 * with every field the BE returns plus the same Approve action so admins
 * don't have to dismiss + re-find the row in the list.
 */
export function SellerApplicationDetail({ seller, onClose, onApprove, isApproving }: Props) {
  const { t } = useTranslation();
  useEscapeKey(seller !== null && !isApproving, onClose);

  if (!seller) return null;

  const fields: { labelKey: string; value: string | null | undefined }[] = [
    { labelKey: "admin.sellers.applicationDialog.shopName", value: seller.shopName },
    { labelKey: "admin.sellers.applicationDialog.status", value: seller.status },
    {
      labelKey: "admin.sellers.applicationDialog.appliedAt",
      value: seller.appliedAt
        ? `${formatDate(seller.appliedAt)} (${formatRelativeTime(seller.appliedAt)})`
        : null,
    },
    {
      labelKey: "admin.sellers.applicationDialog.bankName",
      value: seller.bankName ?? null,
    },
    {
      labelKey: "admin.sellers.applicationDialog.bankAccount",
      value: seller.bankAccount ?? null,
    },
    {
      labelKey: "admin.sellers.applicationDialog.tier",
      value: seller.tier ?? "STANDARD",
    },
    {
      labelKey: "admin.sellers.applicationDialog.vacationMode",
      value: seller.vacationMode
        ? t("admin.sellers.applicationDialog.vacationOn")
        : t("admin.sellers.applicationDialog.vacationOff"),
    },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t("admin.sellers.applicationDialog.close")}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {t("admin.sellers.applicationDialog.title")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("admin.sellers.applicationDialog.subtitle", { shopName: seller.shopName })}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isApproving}
            className="w-8 h-8 rounded-full bg-muted hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {fields.map((f) => (
            <div key={f.labelKey} className="flex items-start gap-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-32 shrink-0 pt-0.5">
                {t(f.labelKey)}
              </span>
              <span className="text-sm text-foreground break-all">{f.value ?? "—"}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            disabled={isApproving}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold text-muted-foreground disabled:opacity-50"
          >
            {t("admin.sellers.applicationDialog.close")}
          </button>
          {!seller.approved ? (
            <button
              onClick={() => onApprove(seller.id)}
              disabled={isApproving}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "var(--primary)" }}
            >
              <IconCircleCheck size={15} />
              {t("admin.sellers.applicationDialog.approve")}
            </button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
