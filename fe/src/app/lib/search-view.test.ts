import { describe, expect, it } from "vitest";

import { requiresBackendSearch } from "./search-view";

describe("requiresBackendSearch", () => {
  it.each([
    ["query", { query: "phone" }],
    ["category", { category: "phones" }],
    ["brand", { brand: "VNShop" }],
    ["minimum price", { minPrice: "100" }],
    ["maximum price", { maxPrice: "500" }],
    ["same-day delivery", { sameDay: true }],
    ["verified seller", { verifiedOnly: true }],
    ["official store", { officialOnly: true }],
    ["backend sort", { sortBy: "price-low" }],
  ])("uses backend search for %s", (_label, criteria) => {
    expect(requiresBackendSearch(criteria)).toBe(true);
  });

  it("keeps the catalog fallback for an unfiltered popular view", () => {
    expect(requiresBackendSearch({ sortBy: "popular" })).toBe(false);
  });
});
