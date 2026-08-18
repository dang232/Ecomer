import { describe, expect, it } from "vitest";

import { sellerIdSchema, productIdSchema } from "@/shared/contracts/api/branded-ids";

import { UNKNOWN_SELLER_ID, toCartView } from "./cart-view";

describe("toCartView", () => {
  it("groups cart lines by seller without losing variant identity", () => {
    const view = toCartView([
      {
        productId: productIdSchema.parse("p-1"),
        name: "Product 1",
        image: "img1.jpg",
        quantity: 1,
        price: 10,
        variantId: "blue",
        parcel: null,
        sellerId: sellerIdSchema.parse("s-1"),
        sellerName: "Shop A",
      },
      {
        productId: productIdSchema.parse("p-2"),
        name: "Product 2",
        image: "img2.jpg",
        quantity: 2,
        price: 20,
        variantId: "large",
        parcel: null,
        sellerId: sellerIdSchema.parse("s-1"),
        sellerName: "Shop A",
      },
      {
        productId: productIdSchema.parse("p-3"),
        name: "Product 3",
        image: "img3.jpg",
        quantity: 1,
        price: 30,
        variantId: undefined,
        parcel: null,
        sellerId: sellerIdSchema.parse("s-2"),
        sellerName: "Shop B",
      },
    ]);

    expect(view.groups).toHaveLength(2);
    expect(view.groups[0]?.lines.map((line) => line.key)).toEqual(["p-1:blue", "p-2:large"]);
    expect(view.subtotalVnd).toBe(80);
  });

  it("keeps absent seller IDs in their own stable unavailable group", () => {
    const view = toCartView([
      {
        productId: productIdSchema.parse("p-1"),
        name: "Product 1",
        image: "img1.jpg",
        quantity: 1,
        price: 10,
        variantId: undefined,
        parcel: null,
        sellerId: undefined,
      },
      {
        productId: productIdSchema.parse("p-2"),
        name: "Product 2",
        image: "img2.jpg",
        quantity: 1,
        price: 20,
        variantId: undefined,
        parcel: null,
        sellerId: sellerIdSchema.parse("s-1"),
      },
    ]);

    expect(view.groups[0]).toMatchObject({ sellerId: UNKNOWN_SELLER_ID, sellerName: undefined });
    expect(view.groups[1]).toMatchObject({ sellerId: "s-1", sellerName: undefined });
  });
});
