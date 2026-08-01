import { describe, expect, it } from "vitest";

import { orderDetailSchema, orderListItemSchema } from "@/shared/contracts/api/order";

import { toOrderView } from "./order-view";

const detailBase = {
  id: "00000000-0000-0000-0000-000000000042",
  orderNumber: "ORD-42",
  paymentStatus: "COMPLETED" as const,
  paymentMethod: "COD" as const,
  itemsTotal: { amount: 320000, currency: "VND" },
  shippingTotal: { amount: 30000, currency: "VND" },
  discount: { amount: 10000, currency: "VND" },
  finalAmount: { amount: 340000, currency: "VND" },
  subOrders: [
    {
      subOrderId: 42,
      sellerId: "seller-42",
      fulfillmentStatus: "PENDING_ACCEPTANCE" as const,
      items: [
        {
          productId: "product-1",
          name: "Phone Pro",
          quantity: 1,
          price: 320000,
        },
      ],
    },
  ],
};

describe("toOrderView", () => {
  it("shows only cancel for a pending order and uses the list summary createdAt as placedAt", () => {
    const detail = orderDetailSchema.parse(detailBase);
    const summary = orderListItemSchema.parse({
      orderId: detailBase.id,
      status: "PENDING",
      createdAt: "2026-07-31T05:15:00Z",
      totalAmount: 340000,
      itemCount: 1,
      subOrders: detailBase.subOrders,
    });

    const view = toOrderView({ detail, summary });

    expect(view.actions).toEqual(["cancel"]);
    expect(view.placedAt).toBe("2026-07-31T05:15:00Z");
    expect(view.timeline[0]).toMatchObject({
      id: "placed",
      occurredAt: "2026-07-31T05:15:00Z",
      current: false,
    });
  });

  it("shows only return and buy-again actions for delivered orders", () => {
    const detail = orderDetailSchema.parse({
      ...detailBase,
      subOrders: [
        {
          ...detailBase.subOrders[0],
          fulfillmentStatus: "DELIVERED",
        },
      ],
    });

    const view = toOrderView({ detail, summary: undefined });

    expect(view.actions).toEqual(["request-return", "buy-again"]);
  });

  it("uses only contract-backed chronology and does not invent unsupported timestamps", () => {
    const detail = orderDetailSchema.parse({
      ...detailBase,
      subOrders: [
        {
          ...detailBase.subOrders[0],
          fulfillmentStatus: "SHIPPED",
        },
      ],
    });

    const view = toOrderView({ detail, summary: undefined });

    expect(view.placedAt).toBeUndefined();
    expect(view.timeline).toEqual([
      expect.objectContaining({
        id: "current",
        occurredAt: undefined,
        current: true,
      }),
    ]);
  });
});
