import { describe, expect, it } from "vitest";

import {
  normalizeSearchSort,
  requiresBackendSearch,
  shouldFallbackToCatalog,
  validatePriceRange,
} from "./search-view";

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

  it("normalizes unsupported rating sort to popular", () => {
    expect(normalizeSearchSort("rating")).toBe("popular");
    expect(requiresBackendSearch({ sortBy: "rating" })).toBe(false);
  });
});

describe("shouldFallbackToCatalog", () => {
  it("falls back when the search index is empty but the catalog has products", () => {
    expect(
      shouldFallbackToCatalog({
        isLoading: false,
        hasError: false,
        totalElements: 0,
        localCatalogCount: 22,
      }),
    ).toBe(true);
  });

  it.each([
    { isLoading: true, hasError: false, totalElements: 0, localCatalogCount: 22 },
    { isLoading: false, hasError: true, totalElements: 0, localCatalogCount: 22 },
    { isLoading: false, hasError: false, totalElements: 3, localCatalogCount: 22 },
    { isLoading: false, hasError: false, totalElements: 0, localCatalogCount: 0 },
  ])("does not fallback for state %j", (state) => {
    expect(shouldFallbackToCatalog(state)).toBe(false);
  });
});

describe("validatePriceRange", () => {
  it.each([
    ["empty range", "", "", null],
    ["minimum only", "2", "", null],
    ["maximum only", "", "20", null],
    ["ascending range", "2", "20", null],
  ])("accepts %s", (_label, min, max, expected) => {
    expect(validatePriceRange(min, max)).toBe(expected);
  });

  it("rejects negative minimum and maximum values", () => {
    expect(validatePriceRange("-2", "20")).toBe("min-negative");
    expect(validatePriceRange("2", "-4")).toBe("max-negative");
  });

  it("rejects a minimum above the maximum", () => {
    expect(validatePriceRange("20", "2")).toBe("min-greater-than-max");
  });
});
