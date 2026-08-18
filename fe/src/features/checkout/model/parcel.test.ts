import { describe, expect, it } from "vitest";

import { productIdSchema } from "@/shared/contracts/api/branded-ids";

import { hasTrustedParcelMetadata } from "./parcel";

describe("hasTrustedParcelMetadata", () => {
  it("accepts a cart when every line has complete parcel metadata", () => {
    const result = hasTrustedParcelMetadata([
      {
        productId: productIdSchema.parse("product-1"),
        name: "One",
        image: "",
        price: 100,
        quantity: 2,
        variantId: "small",
        sellerId: undefined,
        parcel: { weightGrams: 500, lengthCm: 10, widthCm: 8, heightCm: 4 },
      },
      {
        productId: productIdSchema.parse("product-2"),
        name: "Two",
        image: "",
        price: 200,
        quantity: 1,
        variantId: "large",
        sellerId: undefined,
        parcel: { weightGrams: 1500, lengthCm: 30, widthCm: 20, heightCm: 10 },
      },
    ]);

    expect(result).toBe(true);
  });

  it("fails closed when any cart line has no parcel metadata", () => {
    expect(
      hasTrustedParcelMetadata([
        {
          productId: productIdSchema.parse("product-1"),
          name: "One",
          image: "",
          price: 100,
          quantity: 1,
          variantId: undefined,
          sellerId: undefined,
          parcel: null,
        },
      ]),
    ).toBe(false);
  });

  it("fails closed for an empty cart", () => {
    expect(hasTrustedParcelMetadata([])).toBe(false);
  });
});
