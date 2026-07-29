import { describe, expect, it } from "vitest";

import { checkoutSubmissionReducer, type CheckoutSubmissionState } from "./submission";

const created: CheckoutSubmissionState = {
  status: "order-created",
  orderKey: "order-key",
  cartFingerprint: "cart-a",
  provider: "COD",
  paymentKey: "payment-key",
  orderId: "order-1",
  total: 125000,
};

describe("checkoutSubmissionReducer", () => {
  it("does not allow an order-owned state back into order placement", () => {
    expect(
      checkoutSubmissionReducer(created, {
        type: "place",
        attempt: { orderKey: "new-key", cartFingerprint: "cart-b", provider: "VNPAY" },
      }),
    ).toEqual(created);
  });

  it("keeps every order identity field when payment initialization fails", () => {
    const failed = checkoutSubmissionReducer(created, {
      type: "payment-failed",
      message: "provider unavailable",
    });

    expect(failed).toMatchObject({
      status: "failed",
      stage: "payment",
      orderKey: "order-key",
      paymentKey: "payment-key",
      orderId: "order-1",
      total: 125000,
    });
  });
});
