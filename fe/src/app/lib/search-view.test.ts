import { describe, expect, it } from "vitest";

import type { Product } from "../types/ui";

import en from "./i18n/en.json";
import vi from "./i18n/vi.json";
import {
  canUseCatalogBrowse,
  mergeMissingProductImages,
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
    ["minimum rating", { minRating: 4 }],
    ["seller tags", { tags: ["wireless"] }],
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

describe("canUseCatalogBrowse", () => {
  it("uses the catalog as the complete source for category-only browsing", () => {
    expect(canUseCatalogBrowse({ category: "electronics" })).toBe(true);
    expect(canUseCatalogBrowse({ category: "electronics", sortBy: "price-low" })).toBe(true);
  });

  it.each([
    { query: "headphones" },
    { brand: "Sony" },
    { minPrice: "100" },
    { minRating: 4 },
    { tags: ["wireless"] },
    { sameDay: true },
    { verifiedOnly: true },
    { officialOnly: true },
  ])("keeps an advanced search on search-service: %j", (criteria) => {
    expect(canUseCatalogBrowse({ category: "electronics", ...criteria })).toBe(false);
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

  it("treats the catalog request as a fallback while it is loading", () => {
    expect(
      shouldFallbackToCatalog({
        isLoading: false,
        hasError: false,
        totalElements: 0,
        localCatalogCount: 0,
        localCatalogLoading: true,
      }),
    ).toBe(true);
  });
});

describe("mergeMissingProductImages", () => {
  it("fills only missing search images from the catalog projection", () => {
    const searchProducts = [
      { id: "missing", image: "", images: [] },
      {
        id: "complete",
        image: "https://search/complete.jpg",
        images: ["https://search/complete.jpg"],
      },
    ] as Product[];
    const catalogProducts = [
      {
        id: "missing",
        image: "https://catalog/missing.jpg",
        images: ["https://catalog/missing.jpg"],
      },
      {
        id: "complete",
        image: "https://catalog/should-not-win.jpg",
        images: ["https://catalog/should-not-win.jpg"],
      },
    ] as Product[];

    expect(mergeMissingProductImages(searchProducts, catalogProducts)).toEqual([
      {
        ...searchProducts[0],
        image: "https://catalog/missing.jpg",
        images: ["https://catalog/missing.jpg"],
      },
      searchProducts[1],
    ]);
  });
});

describe("search translations", () => {
  it("uses count-free copy for cursor pagination", () => {
    expect(en.search.loadMore).toBe("Load more products");
    expect(vi.search.loadMore).toBe("Xem thêm sản phẩm");
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
