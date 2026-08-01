import type { AdminOrderSummary } from "@/shared/contracts/api";

/** UI-facing view of an order in the admin queue. */
export interface OrderView {
  id: string;
  orderNumber: string | null;
  buyerId: string;
  buyerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export function toOrderView(raw: AdminOrderSummary): OrderView {
  return {
    id: raw.orderId,
    orderNumber: raw.orderNumber ?? null,
    buyerId: raw.buyerId,
    buyerName: raw.buyerName ?? null,
    sellerId: raw.sellerId ?? null,
    sellerName: raw.sellerName ?? null,
    status: raw.status,
    totalAmount: raw.totalAmount,
    itemCount: raw.itemCount,
    createdAt: raw.createdAt ?? null,
    updatedAt: raw.updatedAt ?? null,
  };
}

/** Admin-settable order statuses from the backend. */
export const ADMIN_SETTABLE_ORDER_STATUSES = [
  "ACCEPTED",
  "PACKED",
  "SHIPPED",
  "CANCELLED",
] as const;
export type AdminSettableOrderStatus = (typeof ADMIN_SETTABLE_ORDER_STATUSES)[number];

export function isAdminSettableStatus(s: string): s is AdminSettableOrderStatus {
  return (ADMIN_SETTABLE_ORDER_STATUSES as readonly string[]).includes(s);
}
