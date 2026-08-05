import { describe, expect, it } from "vitest";

import { CHECKOUT_RECOVERY_STORAGE_KEY, createCheckoutRecoveryStore } from "./recovery";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  };
}

describe("checkout recovery", () => {
  it("removes malformed and wrong-version records", () => {
    const storage = memoryStorage();
    storage.setItem(CHECKOUT_RECOVERY_STORAGE_KEY, JSON.stringify({ version: 2, phase: "order" }));

    expect(createCheckoutRecoveryStore(storage).read()).toBeNull();
    expect(storage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY)).toBeNull();
  });

  it("persists Stripe recovery without the client secret", () => {
    const storage = memoryStorage();
    const store = createCheckoutRecoveryStore(storage);
    store.write({
      version: 1,
      phase: "stripe",
      orderKey: "00000000-0000-4000-8000-000000000001",
      cartFingerprint: "cart-a",
      provider: "STRIPE",
      paymentKey: "00000000-0000-4000-8000-000000000002",
      orderId: "order-1",
      paymentId: "00000000-0000-4000-8000-000000000003",
      total: 125000,
      intentId: "pi_1",
      publishableKey: "pk_test",
      purchasedItems: [],
    });

    expect(store.read()).toMatchObject({ phase: "stripe", intentId: "pi_1" });
    expect(storage.getItem(CHECKOUT_RECOVERY_STORAGE_KEY)).not.toContain("clientSecret");
  });

  it("persists the purchased cart snapshot for recovery cleanup", () => {
    const storage = memoryStorage();
    const store = createCheckoutRecoveryStore(storage);
    store.write({
      version: 1,
      phase: "created",
      orderKey: "00000000-0000-4000-8000-000000000001",
      cartFingerprint: "cart-a",
      provider: "STRIPE",
      paymentKey: "00000000-0000-4000-8000-000000000002",
      orderId: "order-1",
      total: 125000,
      purchasedItems: [{ productId: "product-1", variantId: "blue", quantity: 2 }],
    });

    expect(store.read()).toMatchObject({
      purchasedItems: [{ productId: "product-1", variantId: "blue", quantity: 2 }],
    });
  });
});
