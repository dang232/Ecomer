import { describe, expect, it } from "vitest";

import { orderSchema } from "./order";

describe("orderSchema status boundary", () => {
  it.each([
    ["PENDING", "pending"],
    ["CONFIRMED", "confirmed"],
    ["SHIPPED", "shipping"],
    ["DELIVERED", "delivered"],
    ["CANCELLED", "cancelled"],
  ])("maps canonical list status %s to %s", (status, expected) => {
    const order = orderSchema.parse({
      orderId: "00000000-0000-0000-0000-000000000001",
      status,
      totalAmount: 100_000,
      itemCount: 1,
    });

    expect(order.status).toBe(expected);
  });

  it.each([
    [["PENDING_ACCEPTANCE", "ACCEPTED"], "pending"],
    [["ACCEPTED", "PACKED"], "confirmed"],
    [["SHIPPED", "DELIVERED"], "shipping"],
    [["DELIVERED", "DELIVERED"], "delivered"],
    [["REJECTED", "CANCELLED"], "cancelled"],
  ])("derives mixed sub-order states %j as %s", (statuses, expected) => {
    const order = orderSchema.parse({
      id: "00000000-0000-0000-0000-000000000001",
      subOrders: statuses.map((fulfillmentStatus, index) => ({
        subOrderId: index + 1,
        fulfillmentStatus,
        items: [],
      })),
      itemsTotal: { amount: 100_000, currency: "VND" },
      shippingTotal: { amount: 0, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      finalAmount: { amount: 100_000, currency: "VND" },
      paymentStatus: "COMPLETED",
      paymentMethod: "COD",
    });

    expect(order.status).toBe(expected);
  });

  it("uses the server finalAmount as the normalized order total", () => {
    const order = orderSchema.parse({
      id: "00000000-0000-0000-0000-000000000002",
      subOrders: [],
      itemsTotal: { amount: 31_990_000, currency: "VND" },
      shippingTotal: { amount: 30_000, currency: "VND" },
      discount: { amount: 0, currency: "VND" },
      finalAmount: { amount: 32_020_000, currency: "VND" },
      paymentStatus: "PENDING",
      paymentMethod: "COD",
    });

    expect(order.total).toBe(32_020_000);
  });
});
