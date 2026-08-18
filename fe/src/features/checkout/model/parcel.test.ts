import { describe, expect, it } from "vitest";

import { productIdSchema } from "@/shared/contracts/api/branded-ids";

import { trustedParcelDimensions } from "./parcel";

describe("trustedParcelDimensions", () => {
  it("aggregates complete cart lines using quantity and maximum dimensions", () => {
    const result = trustedParcelDimensions([
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

    expect(result).toEqual({
      weightGrams: 2500,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    });
  });

  it("fails closed when any cart line has no parcel metadata", () => {
    expect(
      trustedParcelDimensions([
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
    ).toBeNull();
  });

  it("fails closed for an empty cart", () => {
    expect(trustedParcelDimensions([])).toBeNull();
  });
});
