import { z } from "zod";

import {
  orderSchema,
  pageSchema,
  pendingSubOrderSchema,
  returnSchema,
  type Order,
  type PendingSubOrder,
  type Return,
} from "@/shared/contracts/api";
import type { PaymentMethod } from "@/shared/contracts";
import { api } from "@/shared/api/client";
import { ApiError } from "@/shared/api/envelope";

export type { PendingSubOrder, Return };

export interface PlaceOrderInput {
  /**
   * Server-side resolved at /orders. Send only what the client legitimately
   * knows — productId, optional variantSku, and quantity. Price, seller,
   * name, and image are looked up by order-service against product-service
   * to prevent client-side price tampering.
   */
  items: { productId: string; variantSku?: string; quantity: number }[];
  shippingAddress: {
    street: string;
    ward?: string;
    district: string;
    city: string;
  };
  shippingDetails: {
    recipientName: string;
    recipientPhone: string;
    wardCode: string;
    districtCode: string;
    provinceCode: string;
    weightGrams: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  paymentMethod?: PaymentMethod;
  couponCode?: string;
  notes?: string;
}

export const placeOrder = (body: PlaceOrderInput, idempotencyKey: string) =>
  api.post("/orders", orderSchema, body, { idempotencyKey });

export const myOrders = (params: { page?: number; size?: number; status?: string } = {}) =>
  api.get("/orders", pageSchema(orderSchema), {
    page: params.page,
    size: params.size ?? 20,
    status: params.status,
  });

export const orderById = (id: string) => api.get(`/orders/${encodeURIComponent(id)}`, orderSchema);

export type IdempotencyOrderLookup = { kind: "found"; order: Order } | { kind: "not-found" };

export async function findOrderByIdempotencyKey(key: string): Promise<IdempotencyOrderLookup> {
  try {
    return {
      kind: "found",
      order: await api.get(`/orders/by-idempotency-key/${encodeURIComponent(key)}`, orderSchema),
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { kind: "not-found" };
    }
    throw error;
  }
}

export const cancelOrder = (id: string) =>
  api.delete(`/orders/${encodeURIComponent(id)}/cancel`, orderSchema);

export const requestReturn = (body: {
  orderId: string;
  subOrderId: string;
  reason: string;
  itemIds?: string[];
}) => api.post("/returns", returnSchema, body);

export const myReturns = () => api.get("/returns", z.array(returnSchema));

export const escalateDispute = (returnId: string, body: { description: string }) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/disputes`, returnSchema, body);

export const sellerApproveReturn = (returnId: string) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/approve`, returnSchema);
export const sellerRejectReturn = (returnId: string, body: { reason: string }) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/reject`, returnSchema, body);
export const sellerCompleteReturn = (returnId: string) =>
  api.post(`/returns/${encodeURIComponent(returnId)}/complete`, returnSchema);

// /seller/orders/pending returns List<OrderResponse> (the full nested shape),
// not a flat sub-order list. Flatten each Order's subOrders[] into one
// PendingSubOrder per row so the seller UI can accept/reject/ship at
// sub-order granularity. Mutations also return OrderResponse and we surface
// the first sub-order from the parent — the page invalidates the list
// afterward and re-renders from fresh server state.
function flattenToPendingSubOrders(orders: Order[]): PendingSubOrder[] {
  return orders.flatMap((o) =>
    (o.subOrders ?? []).map((s) => ({
      id: s.id,
      orderId: o.id,
      status: s.status,
      items: s.items,
      createdAt: o.createdAt,
    })),
  );
}

function firstSubOrder(order: Order): PendingSubOrder {
  const s = order.subOrders?.[0];
  return {
    id: s?.id ?? "",
    orderId: order.id,
    status: s?.status ?? "PENDING_ACCEPTANCE",
    items: s?.items,
    createdAt: order.createdAt,
  };
}

export const sellerPendingOrders = async (
  params: { q?: string } = {},
): Promise<PendingSubOrder[]> => {
  const orders = await api.get("/seller/orders/pending", z.array(orderSchema), params);
  return flattenToPendingSubOrders(orders);
};

export const sellerAcceptOrder = async (subOrderId: string): Promise<PendingSubOrder> =>
  firstSubOrder(
    await api.put(`/seller/orders/${encodeURIComponent(subOrderId)}/accept`, orderSchema),
  );
// PUT /seller/orders/{id}/reject accepts no request body per the backend controller.
export const sellerRejectOrder = async (subOrderId: string): Promise<PendingSubOrder> =>
  firstSubOrder(
    await api.put(`/seller/orders/${encodeURIComponent(subOrderId)}/reject`, orderSchema),
  );
export const sellerShipOrder = async (
  subOrderId: string,
  body: { carrier: string; trackingNumber: string },
): Promise<PendingSubOrder> =>
  firstSubOrder(
    await api.put(`/seller/orders/${encodeURIComponent(subOrderId)}/ship`, orderSchema, body),
  );

// Re-export so existing consumers can keep importing pendingSubOrderSchema.
export { pendingSubOrderSchema };
