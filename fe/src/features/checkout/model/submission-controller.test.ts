import { describe, expect, it, vi } from "vitest";

import { createCheckoutRecoveryStore } from "./recovery";
import {
  createCheckoutSubmissionController,
  shouldClearCartAfterSubmission,
  type CheckoutSubmissionDependencies,
  type CheckoutSubmissionInput,
} from "./submission-controller";

const input: CheckoutSubmissionInput = {
  provider: "COD",
  order: {
    items: [{ productId: "product-1", quantity: 1 }],
    shippingAddress: { street: "1 Main", district: "D1", city: "HCMC" },
    shippingDetails: {
      recipientName: "Buyer One",
      recipientPhone: "+84900000000",
      wardCode: "W1",
      districtCode: "D1",
      provinceCode: "P1",
      weightGrams: 1000,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    },
    paymentMethod: "COD",
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function dependencies(
  overrides: Partial<CheckoutSubmissionDependencies> = {},
): CheckoutSubmissionDependencies {
  const storage = new Map<string, string>();
  const keys = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
  ];
  return {
    placeOrder: vi.fn().mockResolvedValue({ id: "order-1", total: 125000 }),
    findOrderByIdempotencyKey: vi.fn().mockResolvedValue({ kind: "not-found" }),
    codConfirm: vi.fn().mockResolvedValue({
      paymentId: "payment-1",
      orderId: "order-1",
      amount: 125000,
      method: "COD",
      status: "AWAITING_COLLECTION",
      transactionRef: null,
      redirectUrl: null,
    }),
    vnpayCreate: vi.fn(),
    momoCreate: vi.fn(),
    vietqrCreate: vi.fn(),
    stripeCreate: vi.fn(),
    paypalCreate: vi.fn(),
    recovery: createCheckoutRecoveryStore({
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    }),
    newKey: () => keys.shift() ?? crypto.randomUUID(),
    now: () => 1,
    sleep: () => Promise.resolve(),
    ...overrides,
  };
}

describe("checkout submission controller", () => {
  it("shares one promise and sends one POST for concurrent submit calls", async () => {
    const gate = deferred<{ id: string; total: number }>();
    const placeOrder = vi.fn(() => gate.promise);
    const controller = createCheckoutSubmissionController(dependencies({ placeOrder }), "cart-a");

    const first = controller.submit(input);
    const second = controller.submit(input);

    expect(first).toBe(second);
    expect(placeOrder).toHaveBeenCalledTimes(1);
    gate.resolve({ id: "order-1", total: 125000 });
    await Promise.all([first, second]);
    expect(placeOrder).toHaveBeenCalledTimes(1);
  });

  it("retries only payment initialization after an order already exists", async () => {
    const placeOrder = vi.fn().mockResolvedValue({ id: "order-1", total: 125000 });
    const codConfirm = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary provider error"))
      .mockResolvedValueOnce({
        paymentId: "payment-1",
        orderId: "order-1",
        amount: 125000,
        method: "COD",
        status: "AWAITING_COLLECTION",
        transactionRef: null,
        redirectUrl: null,
      });
    const deps = dependencies({ placeOrder, codConfirm });
    const controller = createCheckoutSubmissionController(deps, "cart-a");

    await controller.submit(input);
    await controller.submit(input);

    expect(placeOrder).toHaveBeenCalledTimes(1);
    expect(codConfirm).toHaveBeenCalledTimes(2);
  });

  it("keeps the terminal payment state visible until the next explicit checkout", async () => {
    const controller = createCheckoutSubmissionController(dependencies(), "cart-a");

    await controller.submit(input);

    expect(controller.getState().status).toBe("completed");
  });

  it("resumes a recovered order by initializing payment only", async () => {
    const placeOrder = vi.fn();
    const codConfirm = vi.fn();
    const deps = dependencies({ placeOrder, codConfirm });
    deps.recovery.write({
      version: 2,
      phase: "created",
      provider: "COD",
      orderKey: "00000000-0000-4000-8000-000000000001",
      paymentKey: "00000000-0000-4000-8000-000000000002",
      cartFingerprint: "cart-a",
      orderId: "order-1",
      total: 125000,
      purchasedItems: [],
    });
    const controller = createCheckoutSubmissionController(deps, "cart-a");

    await controller.resume();

    expect(placeOrder).not.toHaveBeenCalled();
    expect(codConfirm).toHaveBeenCalledWith(
      { orderId: "order-1" },
      "00000000-0000-4000-8000-000000000002",
    );
  });

  it("retains the server final amount when Stripe response validation fails", async () => {
    const stripeCreate = vi.fn().mockResolvedValue({
      payment: {
        paymentId: "payment-1",
        orderId: "order-1",
        amount: 125000,
        method: "STRIPE",
        status: "PENDING",
        transactionRef: null,
        redirectUrl: null,
      },
      publishableKey: "pk_test",
      clientSecret: "",
      intentId: "intent-1",
    });
    const controller = createCheckoutSubmissionController(dependencies({ stripeCreate }), "cart-a");

    const result = await controller.submit({ ...input, provider: "STRIPE" });

    expect(result.orderId).toBe("order-1");
    expect(result.state.status).toBe("failed");
    expect("total" in result.state && result.state.total).toBe(125000);
  });

  it.each([
    ["pending", true],
    ["completed", true],
    ["failed", false],
  ] as const)("clears the cart only after a %s submission", (status, expected) => {
    expect(
      shouldClearCartAfterSubmission({
        state: { status } as never,
      }),
    ).toBe(expected);
  });
});
