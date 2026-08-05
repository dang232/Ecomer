import { describe, expect, it } from "vitest";

import { productDetailSchema, productSummarySchema } from "@/shared/contracts/api/product";

describe("productSummarySchema", () => {
  it("accepts null rating projections for products without approved reviews", () => {
    const result = productSummarySchema.parse({
      id: "2ff65816-fa6d-4bb2-beaf-47d5fffa0445",
      name: "Catalog product",
      rating: null,
      reviewCount: null,
    });

    expect(result.rating).toBeNull();
    expect(result.reviewCount).toBeNull();
  });

  it("accepts nullable image URLs from search projections", () => {
    const result = productSummarySchema.parse({
      id: "2ff65816-fa6d-4bb2-beaf-47d5fffa0445",
      name: "Search product",
      imageUrl: null,
    });

    expect(result.imageUrl).toBeNull();
  });

  it("accepts null variant image URLs from product-service", () => {
    const result = productSummarySchema.parse({
      id: "2ff65816-fa6d-4bb2-beaf-47d5fffa0445",
      name: "Seller draft",
      variants: [{ sku: "SKU-1", name: "Standard", imageUrl: null }],
    });

    expect(result.variants?.[0]?.imageUrl).toBeNull();
  });

  it("accepts a newly-created draft with nullable optional product fields", () => {
    const result = productDetailSchema.parse({
      id: "2ff65816-fa6d-4bb2-beaf-47d5fffa0445",
      sellerId: "seller-1",
      name: "Seller draft",
      description: null,
      categoryId: "electronics",
      brand: null,
      rating: null,
      variants: [{ sku: "SKU-1", name: "Standard", imageUrl: null }],
      images: [],
    });

    expect(result.description).toBeNull();
    expect(result.brand).toBeNull();
  });
});
