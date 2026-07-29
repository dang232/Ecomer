import { describe, expect, it } from "vitest";

import { paymentStatusSchema } from "./payment";

const payment = (status: string) => ({
  paymentId: "payment-1",
  orderId: "order-1",
  amount: 125000,
  method: "COD",
  status,
  transactionRef: null,
  redirectUrl: null,
});

describe("paymentStatusSchema", () => {
  it.each(["AWAITING_COLLECTION", "PARTIALLY_REFUNDED", "REFUNDED", "PAYMENT_TIMEOUT"])(
    "accepts %s",
    (status) => {
      expect(paymentStatusSchema.parse(payment(status)).status).toBe(status);
    },
  );

  it("rejects an unknown payment status", () => {
    expect(() => paymentStatusSchema.parse(payment("RECONCILING"))).toThrow();
  });
});
