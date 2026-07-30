import { describe, expect, it } from "vitest";

import { productSummarySchema } from "@/shared/contracts/api/product";

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
});
