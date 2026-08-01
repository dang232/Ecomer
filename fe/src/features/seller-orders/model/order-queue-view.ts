import type * as api from "@/shared/contracts/api";

/** Actions available for a given sub-order status. */
export type SellerOrderAction = "accept" | "reject" | "ship";

export type FulfillmentStatus = (typeof api.FULFILLMENT_STATUS_VALUES)[number];

/** Maps each known fulfillment status to the set of actions a seller can take. */
const STATUS_ACTIONS: Record<FulfillmentStatus, readonly SellerOrderAction[]> = {
  PENDING_ACCEPTANCE: ["accept", "reject"],
  ACCEPTED: ["ship"],
  PACKED: [],
  SHIPPED: [],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
};

export interface SellerOrderRow {
  id: string;
  orderId: string;
  createdAt: string;
  status: FulfillmentStatus;
  itemCount: number;
  itemSummary: string;
  actions: readonly SellerOrderAction[];
}

/** Derives a typed order row from a pending sub-order. Unknown wire values fail
 * the PendingSubOrder schema rather than defaulting to pending. */
export function toSellerOrderRow(subOrder: api.PendingSubOrder): SellerOrderRow {
  type Item = { name?: string; quantity?: number };
  const isItem = (value: unknown): value is Item => {
    if (typeof value !== "object" || value === null) return false;
    const record = value as Record<string, unknown>;
    return (
      (record.name === undefined || typeof record.name === "string") &&
      (record.quantity === undefined || typeof record.quantity === "number")
    );
  };
  const items = (subOrder.items ?? []).filter(isItem);
  const itemCount = items.length;

  let itemSummary = "";
  if (itemCount === 0) {
    itemSummary = "";
  } else if (itemCount === 1) {
    const qty = items[0].quantity ?? 1;
    itemSummary = `${items[0].name ?? ""} x${qty}`;
  } else {
    const qty1 = items[0].quantity ?? 1;
    const qty2 = items[1].quantity ?? 1;
    itemSummary = `${items[0].name ?? ""} x${qty1}, ${items[1].name ?? ""} x${qty2}`;
  }

  const status = subOrder.status;
  const row: SellerOrderRow = {
    id: subOrder.id,
    orderId: subOrder.orderId,
    createdAt: subOrder.createdAt ?? "",
    status,
    itemCount,
    itemSummary,
    actions: STATUS_ACTIONS[status],
  };
  return row;
}
