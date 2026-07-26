import { describe, expect, it } from "vitest";

import { resolveSearchDisplayState } from "./search-display-state";

const baseState = {
  searchEnabled: true,
  searchLoading: false,
  searchHasError: false,
  searchTotalElements: 4,
  searchProductCount: 4,
  catalogLoading: false,
  catalogHasError: false,
  catalogProductCount: 8,
  visibleProductCount: 4,
};

describe("resolveSearchDisplayState", () => {
  it("uses the catalog for an unfiltered browse view", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchEnabled: false,
        visibleProductCount: 8,
      }),
    ).toEqual({ source: "catalog", status: "ready", notice: null });
  });

  it("keeps a search with no data in the loading state", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchLoading: true,
        searchTotalElements: 0,
        searchProductCount: 0,
        visibleProductCount: 0,
      }),
    ).toEqual({ source: "search", status: "loading", notice: null });
  });

  it("keeps previously loaded V2 results with a warning when search is unavailable", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchHasError: true,
        searchTotalElements: 0,
        searchProductCount: 0,
        visibleProductCount: 8,
      }),
    ).toEqual({ source: "search", status: "ready", notice: "search-unavailable" });
  });

  it("renders an error when V2 search has no usable data", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchHasError: true,
        searchTotalElements: 0,
        searchProductCount: 0,
        catalogProductCount: 0,
        visibleProductCount: 0,
      }),
    ).toEqual({ source: "search", status: "error", notice: "search-unavailable" });
  });

  it("renders an empty state when V2 search has no matches", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchTotalElements: 0,
        searchProductCount: 0,
        visibleProductCount: 0,
      }),
    ).toEqual({ source: "search", status: "empty", notice: null });
  });

  it("uses the catalog while an empty search fallback is loading", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchTotalElements: 0,
        searchProductCount: 0,
        catalogFallbackActive: true,
        catalogLoading: true,
        visibleProductCount: 0,
      }),
    ).toEqual({ source: "catalog", status: "loading", notice: null });
  });

  it("distinguishes a successful empty response from a failed request", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchTotalElements: 0,
        searchProductCount: 0,
        catalogProductCount: 0,
        visibleProductCount: 0,
      }),
    ).toEqual({ source: "search", status: "empty", notice: null });
  });

  it("keeps stale results visible while a request refreshes", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchLoading: true,
      }),
    ).toEqual({ source: "search", status: "ready", notice: null });
  });

  it("keeps stale indexed results visible when a background refresh fails", () => {
    expect(
      resolveSearchDisplayState({
        ...baseState,
        searchHasError: true,
      }),
    ).toEqual({ source: "search", status: "ready", notice: "search-unavailable" });
  });
});
