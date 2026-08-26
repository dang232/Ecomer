import { describe, expect, it } from "vitest";

import { cartItemSchema, cartSchema } from "@/shared/contracts/api/cart";

describe("cart contract characterization", () => {
  it("normalizes backend money, aliases, brands, variants, and parcel metadata", () => {
    const parsed = cartItemSchema.parse({
      productId: "product-1",
      productName: "Backend headphones",
      productImage: "https://cdn.example/headphones.png",
      unitPrice: { amount: 125_000, currency: "VND" },
      subtotal: { amount: 250_000, currency: "VND" },
      quantity: 2,
      sellerId: "seller-1",
      variantSku: "BLUE-L",
       parcel: { weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 10, declaredValueMinor: 125000 },
      upstreamOnly: "accepted then normalized away",
    });

    expect(parsed).toEqual({
      productId: "product-1",
      name: "Backend headphones",
      image: "https://cdn.example/headphones.png",
      price: 125_000,
      quantity: 2,
      sellerId: "seller-1",
      variantId: "BLUE-L",
       parcel: { weightGrams: 500, lengthCm: 20, widthCm: 15, heightCm: 10, declaredValueMinor: 125000 },
    });
    expect(parsed.productId).toBe("product-1");
  });

  it("prefers the persisted parcel snapshot over the live parcel alias", () => {
    const result = cartItemSchema.parse({
      productId: "2ff65816-fa6d-4bb2-beaf-47d5fffa0445",
      variantId: "SKU-1",
      productName: "Parcel product",
      productImage: "",
      unitPrice: { amount: 1, currency: "VND" },
      quantity: 1,
      subtotal: { amount: 1, currency: "VND" },
      parcel: { weightGrams: 1, lengthCm: 1, widthCm: 1, heightCm: 1, declaredValueMinor: 1 },
      parcelSnapshot: { weightGrams: 2, lengthCm: 2, widthCm: 2, heightCm: 2, declaredValueMinor: 2 },
      addedAt: "2026-08-18T09:00:00.000Z",
    });

    expect(result.parcel?.declaredValueMinor).toBe(2);
  });

  it("preserves legacy alias precedence and default values", () => {
    const parsed = cartItemSchema.parse({
      productId: "product-2",
      name: "Legacy name",
      productName: "Backend name",
      image: "legacy.png",
      productImage: "backend.png",
      price: 99_000,
      unitPrice: 100_000,
      quantity: 1,
      variantId: null,
      variantSku: null,
    });

    expect(parsed).toMatchObject({
      name: "Legacy name",
      image: "legacy.png",
      price: 99_000,
      quantity: 1,
      variantId: undefined,
      parcel: null,
    });
  });

  it("defaults a missing cart item list and normalizes total money", () => {
    expect(
      cartSchema.parse({ totalAmount: { amount: 250_000, currency: "VND" } }),
    ).toMatchObject({ items: [], totalAmount: 250_000 });
  });

  it("rejects non-string branded product ids", () => {
    expect(() => cartItemSchema.parse({ productId: 123, quantity: 1 })).toThrow();
  });
});
