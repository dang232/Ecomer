import type { SellerSummary } from "@/shared/contracts/api";

/** UI-facing view of a seller in the admin approval queue. */
export interface SellerView {
  id: string;
  shopName: string;
  status: string;
  approved: boolean;
  appliedAt: string | undefined;
  bankName: string | undefined;
  last4: string | undefined;
  tier: string | undefined;
  vacationMode: boolean | undefined;
}

export function toSellerView(raw: SellerSummary): SellerView {
  return {
    id: raw.id,
    shopName: raw.shopName,
    status: raw.status ?? (raw.approved ? "APPROVED" : "PENDING"),
    approved: raw.approved ?? raw.status === "APPROVED",
    appliedAt: raw.appliedAt,
    bankName: raw.bankName,
    last4: raw.last4,
    tier: raw.tier,
    vacationMode: raw.vacationMode,
  };
}