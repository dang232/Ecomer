import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as SearchEndpoints from "@/shared/api/endpoints/search";
import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useSearchV2 } from "./use-search-v2";

type CursorSearchParams = SearchEndpoints.CursorSearchParams;

const searchProductsV2Mock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/endpoints/search", async (importOriginal) => {
  const actual = await importOriginal<typeof SearchEndpoints>();
  return { ...actual, searchProductsV2: searchProductsV2Mock as typeof actual.searchProductsV2 };
});

const firstPage = {
  data: {
    items: [{ id: "product-1", name: "Headphones", price: 1_990_000 }],
    nextCursor: "cursor-page-2",
    hasMore: true,
  },
  status: 200,
  headers: new Headers(),
};

const secondPage = {
  data: {
    items: [{ id: "product-2", name: "Speakers", price: 2_990_000 }],
    nextCursor: null,
    hasMore: false,
  },
  status: 200,
  headers: new Headers(),
};

beforeEach(() => {
  searchProductsV2Mock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSearchV2", () => {
  it("warms the next cursor page after the current category page loads", async () => {
    const params = { category: "electronics", limit: 20, includeFacets: true };
    searchProductsV2Mock.mockImplementation((request: { cursor?: string }) =>
      Promise.resolve(request.cursor === "cursor-page-2" ? secondPage : firstPage),
    );
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useSearchV2(params), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await waitFor(() =>
      expect(searchProductsV2Mock).toHaveBeenCalledWith(
        { ...params, cursor: "cursor-page-2" },
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.data?.pages).toHaveLength(1);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(searchProductsV2Mock).toHaveBeenCalledTimes(2);
  });

  it("does not reuse a retained cursor when query, filter, and sort change", async () => {
    const newestParams: CursorSearchParams = {
      q: "phone",
      category: "audio",
      sort: "newest",
      limit: 20,
      includeFacets: true,
    };
    const priceLowParams: CursorSearchParams = {
      q: "headphones",
      category: "electronics",
      sort: "price-low",
      limit: 20,
      includeFacets: true,
    };
    const newestPage = {
      ...firstPage,
      data: { ...firstPage.data, nextCursor: "newest-next" },
    };
    const priceLowPage = {
      ...firstPage,
      data: { ...firstPage.data, nextCursor: "price-low-next" },
    };

    searchProductsV2Mock.mockImplementation((request: CursorSearchParams) =>
      Promise.resolve(request.sort === "newest" ? newestPage : priceLowPage),
    );
    const { Wrapper } = makeWrapper();

    const { result, rerender } = renderHook(
      ({ params }: { params: CursorSearchParams }) => useSearchV2(params),
      { initialProps: { params: newestParams }, wrapper: Wrapper },
    );

    await waitFor(() =>
      expect(searchProductsV2Mock).toHaveBeenCalledWith(
        { ...newestParams, cursor: undefined },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() =>
      expect(searchProductsV2Mock).toHaveBeenCalledWith(
        { ...newestParams, cursor: "newest-next" },
        expect.any(AbortSignal),
      ),
    );

    rerender({ params: priceLowParams });

    await waitFor(() =>
      expect(searchProductsV2Mock).toHaveBeenCalledWith(
        { ...priceLowParams, cursor: undefined },
        expect.any(AbortSignal),
      ),
    );
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    await waitFor(() =>
      expect(searchProductsV2Mock).toHaveBeenCalledWith(
        { ...priceLowParams, cursor: "price-low-next" },
        expect.any(AbortSignal),
      ),
    );

    const requests = searchProductsV2Mock.mock.calls.map(
      ([request]) => request as CursorSearchParams,
    );
    expect(requests).not.toContainEqual({ ...priceLowParams, cursor: "newest-next" });
  });
});
