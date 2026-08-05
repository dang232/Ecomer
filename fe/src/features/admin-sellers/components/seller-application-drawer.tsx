import { useTranslation } from "react-i18next";

import { formatDate, formatRelativeTime } from "@/shared/lib";

import type { SellerView } from "../model/seller-view";

interface SellerApplicationDrawerProps {
  seller: SellerView | null;
  onApprove: (id: string) => void;
  isApproving: boolean;
}

/**
 * Detail surface for the seller approval queue.
 *
 * Rendered as a child of `AdminQueueFrame` (URL-owned selection). The frame
 * already provides the drawer shell and close affordance; this component
 * supplies the body content and Approve action.
 */
export function SellerApplicationDrawer({
  seller,
  onApprove,
  isApproving,
}: SellerApplicationDrawerProps) {
  const { t } = useTranslation();

  if (!seller) return null;

  const fields: { label: string; value: string }[] = [
    { label: t("admin.sellers.applicationDialog.shopName") ?? "Shop", value: seller.shopName },
    { label: t("admin.sellers.applicationDialog.status") ?? "Status", value: seller.status },
    {
      label: t("admin.sellers.applicationDialog.appliedAt") ?? "Applied",
      value: seller.appliedAt
        ? `${formatDate(seller.appliedAt)} (${formatRelativeTime(seller.appliedAt)})`
        : "—",
    },
    {
      label: t("admin.sellers.applicationDialog.bankName") ?? "Bank",
      value: seller.bankName ?? "—",
    },
    {
      label: t("admin.sellers.applicationDialog.destinationLast4") ?? "Last 4",
      value: seller.last4 ?? "—",
    },
    {
      label: t("admin.sellers.applicationDialog.tier") ?? "Tier",
      value: seller.tier ?? "STANDARD",
    },
    {
      label: t("admin.sellers.applicationDialog.vacationMode") ?? "Vacation",
      value: seller.vacationMode
        ? (t("admin.sellers.applicationDialog.vacationOn") ?? "On")
        : (t("admin.sellers.applicationDialog.vacationOff") ?? "Off"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label} className="flex items-start gap-4">
            <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {f.label}
            </span>
            <span className="break-all text-sm text-foreground">{f.value}</span>
          </div>
        ))}
      </div>

      {!seller.approved ? (
        <button
          onClick={() => onApprove(seller.id)}
          disabled={isApproving}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {t("admin.sellers.applicationDialog.approve") ?? "Approve seller"}
        </button>
      ) : null}
    </div>
  );
}
