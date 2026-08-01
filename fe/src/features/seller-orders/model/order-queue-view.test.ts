import { describe, expect, it } from "vitest";

import { orderIdSchema } from "@/shared/contracts/api/branded-ids";

import { toSellerOrderRow } from "./order-queue-view";

const baseOrder = {
  id: "sub-1",
  orderId: orderIdSchema.parse("order-1"),
  createdAt: "2026-07-29T10:00:00Z",
  status: "PENDING_ACCEPTANCE" as const,
  items: [{ id: "item-1", productId: "p-1", name: "Widget", price: 10000, quantity: 2 }],
  itemCount: 1,
};

describe("toSellerOrderRow", () => {
  it("exposes valid actions for each pending sub-order state", () => {
    const order = { ...baseOrder };

    expect(toSellerOrderRow({ ...order, status: "PENDING_ACCEPTANCE" }).actions).toEqual([
      "accept",
      "reject",
    ]);
    expect(toSellerOrderRow({ ...order, status: "ACCEPTED" }).actions).toEqual(["ship"]);
    expect(toSellerOrderRow({ ...order, status: "SHIPPED" }).actions).toEqual([]);
  });

  it("derives itemCount and itemSummary from items array", () => {
    const row = toSellerOrderRow({
      ...baseOrder,
      items: [
        { id: "i1", productId: "p-1", name: "Apple", price: 100, quantity: 2 },
        { id: "i2", productId: "p-2", name: "Banana", price: 200, quantity: 1 },
      ],
    });
    expect(row.itemCount).toBe(2);
    expect(row.itemSummary).toBe("Apple x2, Banana x1");
  });

  it("maps all FulfillmentStatus values without crashing", () => {
    const statuses = [
      "PENDING_ACCEPTANCE",
      "ACCEPTED",
      "PACKED",
      "SHIPPED",
      "DELIVERED",
      "REJECTED",
      "CANCELLED",
    ] as const;
    for (const status of statuses) {
      const row = toSellerOrderRow({ ...baseOrder, status });
      expect(row.status).toBe(status);
      expect(Array.isArray(row.actions)).toBe(true);
    }
  });
});
