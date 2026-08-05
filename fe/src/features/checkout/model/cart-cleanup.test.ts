import { describe, expect, it, vi } from "vitest";

import {
  cleanupThenRedirect,
  calculateCartCleanupOperations,
  type PurchasedCartItem,
} from "./cart-cleanup";

describe("checkout cart cleanup", () => {
  it("subtracts purchased quantities and leaves concurrent additions untouched", () => {
    const purchased: PurchasedCartItem[] = [
      { productId: "purchased", variantId: "blue", quantity: 1 },
      { productId: "exact", quantity: 2 },
    ];

    expect(
      calculateCartCleanupOperations(
        [
          { productId: "purchased", variantId: "blue", quantity: 3 },
          { productId: "exact", quantity: 2 },
          { productId: "added-after-checkout", quantity: 1 },
        ],
        purchased,
      ),
    ).toEqual([
      { kind: "update", productId: "purchased", variantId: "blue", quantity: 2 },
      { kind: "remove", productId: "exact", variantId: undefined },
    ]);
  });

  it("awaits item cleanup before assigning a redirect URL", async () => {
    let cleanupFinished = false;
    const cleanup = vi.fn(async () => {
      await Promise.resolve();
      cleanupFinished = true;
    });
    const assign = vi.fn(() => {
      expect(cleanupFinished).toBe(true);
    });

    await cleanupThenRedirect(
      "https://pay.example/redirect",
      [{ productId: "p1", quantity: 1 }],
      cleanup,
      assign,
    );

    expect(cleanup).toHaveBeenCalledWith([{ productId: "p1", quantity: 1 }]);
    expect(assign).toHaveBeenCalledWith("https://pay.example/redirect");
  });
});
