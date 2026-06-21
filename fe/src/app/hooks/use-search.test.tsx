import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../lib/api";

const searchProductsMock = vi.fn();

vi.mock("../lib/api/endpoints/search", () => ({
  searchProducts: (...args: unknown[]) => searchProductsMock(...args),
}));

import { useSearch } from "./use-search";
import { makeWrapper } from "../test-utils/render-with-query-client";


beforeEach(() => {
  searchProductsMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useSearch", () => {
  it("does not call the endpoint when disabled", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useSearch({ q: "tai nghe" }, false), { wrapper: Wrapper });
    expect(searchProductsMock).not.toHaveBeenCalled();
  });

  it("forwards search params to the endpoint", async () => {
    searchProductsMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0 });
    const { Wrapper } = makeWrapper();
    const params = {
      q: "tai nghe",
      category: "electronics",
      minPrice: 100_000,
      maxPrice: 500_000,
      sort: "price-low",
      page: 1,
      size: 24,
    };
    const { result } = renderHook(() => useSearch(params), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(searchProductsMock).toHaveBeenCalledWith(params);
  });

  it("normalises server products into the UI Product shape with derived discount", async () => {
    searchProductsMock.mockResolvedValue({
      content: [
        {
          id: "srv-9",
          name: "Tai nghe",
          price: 4_000_000,
          originalPrice: 5_000_000,
          image: "https://cdn/x.jpg",
          category: "electronics",
          rating: 4.5,
        },
      ],
      totalElements: 1,
      totalPages: 1,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSearch({ q: "tai nghe" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    const item = result.current.products[0];
    expect(item.id).toBe("srv-9");
    expect(item.discount).toBe(20);
    expect(item.images).toEqual(["https://cdn/x.jpg"]);
    expect(result.current.totalElements).toBe(1);
  });

  it("exposes errors verbatim — callers decide on fallback behaviour", async () => {
    const apiErr = new ApiError(503, "SERVICE_UNAVAILABLE", "downstream is down");
    searchProductsMock.mockRejectedValue(apiErr);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSearch({ q: "fail" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBe(apiErr));
    expect(result.current.products).toEqual([]);
  });

  it("derives totalElements from the products array when the server omits it", async () => {
    searchProductsMock.mockResolvedValue({
      content: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
      ],
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSearch({ q: "x" }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.totalElements).toBe(2);
  });
});
