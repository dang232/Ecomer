import type { Dispute } from "@/shared/contracts/api";

/** UI-facing view of a dispute in the admin queue. */
export interface DisputeView {
  id: string;
  returnId: string;
  status: "OPEN" | "RESOLVED";
  description: string | undefined;
  sellerResponse: string | undefined;
  orderId: string | undefined;
  orderNumber: string | undefined;
  buyerId: string | undefined;
  buyerName: string | undefined;
  sellerId: string | undefined;
  sellerName: string | undefined;
  createdAt: string | undefined;
}

export function toDisputeView(raw: Dispute): DisputeView {
  return {
    id: raw.id,
    returnId: raw.returnId,
    status: raw.status,
    description: raw.description,
    sellerResponse: raw.sellerResponse,
    orderId: raw.orderId,
    orderNumber: raw.orderNumber,
    buyerId: raw.buyerId,
    buyerName: raw.buyerName,
    sellerId: raw.sellerId,
    sellerName: raw.sellerName,
    createdAt: raw.createdAt,
  };
}