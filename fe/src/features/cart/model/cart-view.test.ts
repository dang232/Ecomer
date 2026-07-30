import { describe, expect, it } from "vitest";

import { UNKNOWN_SELLER_ID, toCartView } from "./cart-view";

describe("toCartView", () => {
  it("groups cart lines by seller without losing variant identity", () => {
    const view = toCartView([
      {
        productId: "p-1",
        variantId: "blue",
        sellerId: "s-1",
        sellerName: "Shop A",
        quantity: 1,
        price: 10,
      },
      {
        productId: "p-2",
        variantId: "large",
        sellerId: "s-1",
        sellerName: "Shop A",
        quantity: 2,
        price: 20,
      },
      { productId: "p-3", sellerId: "s-2", sellerName: "Shop B", quantity: 1, price: 30 },
    ]);

    expect(view.groups).toHaveLength(2);
    expect(view.groups[0]?.lines.map((line) => line.key)).toEqual(["p-1:blue", "p-2:large"]);
    expect(view.subtotalVnd).toBe(80);
  });

  it("keeps absent seller IDs in their own stable unavailable group", () => {
    const view = toCartView([
      { productId: "p-1", quantity: 1, price: 10 },
      { productId: "p-2", sellerId: "s-1", quantity: 1, price: 20 },
    ]);

    expect(view.groups[0]).toMatchObject({ sellerId: UNKNOWN_SELLER_ID, sellerName: undefined });
    expect(view.groups[1]).toMatchObject({ sellerId: "s-1", sellerName: undefined });
  });
});
