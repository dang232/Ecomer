import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeWrapper } from "../test-utils/render-with-query-client";

import { useSearchV2 } from "./use-search-v2";

const searchProductsV2Mock = vi.fn();

vi.mock("../lib/api/endpoints/search", () => ({
  searchProductsV2: (...args: unknown[]) => searchProductsV2Mock(...args),
}));

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
});
