import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as ProductEndpoints from "@/shared/api/endpoints/products";
import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useProductsV2 } from "./use-products-v2";

const productListV2Mock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/endpoints/products", async (importOriginal) => {
  const actual = await importOriginal<typeof ProductEndpoints>();
  return { ...actual, productListV2: productListV2Mock as typeof actual.productListV2 };
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
  productListV2Mock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useProductsV2", () => {
  it("warms the next cursor page after the current catalog page loads", async () => {
    const params = { limit: 20 };
    productListV2Mock.mockImplementation((request: { cursor?: string }) =>
      Promise.resolve(request.cursor === "cursor-page-2" ? secondPage : firstPage),
    );
    const { Wrapper } = makeWrapper();

    const { result } = renderHook(() => useProductsV2(params), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await waitFor(() =>
      expect(productListV2Mock).toHaveBeenCalledWith(
        { ...params, cursor: "cursor-page-2" },
        expect.any(AbortSignal),
      ),
    );
    expect(result.current.data?.pages).toHaveLength(1);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(productListV2Mock).toHaveBeenCalledTimes(2);
  });
});
