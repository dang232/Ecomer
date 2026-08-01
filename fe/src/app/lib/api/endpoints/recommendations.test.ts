import { describe, expect, it } from "vitest";

import { recommendationItemsSchema } from "./recommendations";

/**
 * Regression coverage for the recommendations endpoint Zod schema.
 * Mirrors the {@code users.test.ts} pattern of locking the Zod shape
 * against drift on either side of the BE/FE boundary.
 */
describe("recommendations endpoint Zod schema", () => {
  const wireItem = {
    id: "p-1",
    name: "Sample Product",
    image: "https://cdn/p.jpg",
    price: 199_000,
    originalPrice: 249_000,
    sellerId: "s-1",
    category: "phones",
    reviewCount: 42,
    rating: 4.7,
    sold: 100,
  };

  it("parses the canonical recommendations response shape", () => {
    const parsed = recommendationItemsSchema.parse([wireItem]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe("p-1");
    expect(parsed[0].price).toBe(199_000);
  });

  it("accepts items with nullable / missing optional fields", () => {
    const parsed = recommendationItemsSchema.parse([
      { id: "p-2" },
      { id: "p-3", name: null, image: null, price: null, rating: null },
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[1].rating ?? null).toBeNull();
  });

  it("rejects items with no id", () => {
    expect(() => recommendationItemsSchema.parse([{ name: "no-id" }])).toThrow();
  });

  it("rejects a non-array response", () => {
    expect(() => recommendationItemsSchema.parse({ items: [] })).toThrow();
  });

  it("tolerates BE-side extras through .loose()", () => {
    const parsed = recommendationItemsSchema.parse([
      {
        ...wireItem,
        // Hypothetical future BE addition — must not break the FE.
        coPurchaseCount: 17,
        scoreDebug: "0.84:0.12",
      },
    ]);
    expect(parsed[0].id).toBe("p-1");
  });
});
