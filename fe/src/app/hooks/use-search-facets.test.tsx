import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchFacetsMock = vi.fn();
vi.mock("../lib/api/endpoints/search", () => ({
  searchFacets: (...args: unknown[]) => searchFacetsMock(...args),
}));

import { makeWrapper } from "../test-utils/render-with-query-client";

import { useSearchFacets } from "./use-search-facets";

beforeEach(() => {
  searchFacetsMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSearchFacets", () => {
  it("returns server data when enabled", async () => {
    searchFacetsMock.mockResolvedValue({
      categories: [{ key: "fashion", count: 12 }],
      brands: [{ key: "VNShop", count: 3 }],
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSearchFacets({ q: "shoes" }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.facets.categories).toHaveLength(1));
    expect(result.current.facets.categories[0]).toMatchObject({ key: "fashion", count: 12 });
    expect(result.current.facets.brands).toHaveLength(1);
    expect(searchFacetsMock).toHaveBeenCalledWith({
      q: "shoes",
      category: undefined,
      brand: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    });
  });

  it("does not call the endpoint when disabled", () => {
    searchFacetsMock.mockResolvedValue({ categories: [], brands: [] });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSearchFacets({ enabled: false }), { wrapper: Wrapper });

    expect(searchFacetsMock).not.toHaveBeenCalled();
    expect(result.current.facets).toEqual({ categories: [], brands: [], tags: [] });
  });

  it("forwards all filter params to the endpoint", async () => {
    searchFacetsMock.mockResolvedValue({ categories: [], brands: [] });
    const { Wrapper } = makeWrapper();
    renderHook(
      () =>
        useSearchFacets({
          q: "phone",
          category: "electronics",
          brand: "Samsung",
          minPrice: 100,
          maxPrice: 500,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(searchFacetsMock).toHaveBeenCalled());
    expect(searchFacetsMock).toHaveBeenCalledWith({
      q: "phone",
      category: "electronics",
      brand: "Samsung",
      minPrice: 100,
      maxPrice: 500,
    });
  });
});
