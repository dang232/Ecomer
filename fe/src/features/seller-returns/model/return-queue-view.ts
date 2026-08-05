import type { Return, ReturnStatus } from "@/shared/api/endpoints/returns";

/** Status tab options available in the returns queue UI. */
export const RETURN_TAB_VALUES = ["requested", "approved", "completed", "rejected"] as const;
export type ReturnTab = (typeof RETURN_TAB_VALUES)[number];

/** Whether the given tab matches the given wire status. */
function statusMatchesTab(tab: ReturnTab, status: ReturnStatus): boolean {
  switch (tab) {
    case "requested":
      return status === "REQUESTED";
    case "approved":
      return status === "APPROVED";
    case "completed":
      return status === "COMPLETED";
    case "rejected":
      return status === "REJECTED";
  }
}

/** Whether the seller can act on a return in the given status. */
export function canSellerAct(status: ReturnStatus): "approve" | "complete" | null {
  if (status === "REQUESTED") return "approve";
  if (status === "APPROVED") return "complete";
  return null;
}

/** Derives a typed return row for the seller queue. */
export interface SellerReturnRow {
  id: string;
  orderId: string;
  reason: string;
  status: ReturnStatus;
  requestedAt: string;
  action: "approve" | "complete" | null;
}

export function toSellerReturnRow(ret: Return): SellerReturnRow {
  return {
    id: ret.id,
    orderId: ret.orderId,
    reason: ret.reason ?? "",
    status: ret.status,
    requestedAt: ret.requestedAt ?? ret.createdAt ?? "",
    action: canSellerAct(ret.status),
  };
}

/** Filters a list of returns to those matching the given tab. */
export function filterReturnsByTab(returns: readonly Return[], tab: ReturnTab): Return[] {
  return returns.filter((r) => statusMatchesTab(tab, r.status));
}
