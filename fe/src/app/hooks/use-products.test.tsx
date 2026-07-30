import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api";

const productListMock = vi.fn();
const productByIdMock = vi.fn();

vi.mock("@/shared/api/endpoints/products", () => ({
  productList: (...args: unknown[]) => productListMock(...args),
  productById: (...args: unknown[]) => productByIdMock(...args),
}));

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useProduct, useProducts } from "./use-products";

beforeEach(() => {
  productListMock.mockReset();
  productByIdMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useProducts", () => {
  it("normalises server products into the UI Product shape", async () => {
    productListMock.mockResolvedValue({
      content: [
        {
          id: "srv-1",
          name: "Tai nghe Sony",
          price: 4_990_000,
          originalPrice: 5_990_000,
          image: "https://cdn/sony.jpg",
          category: "electronics",
          sellerId: "s1",
          sellerName: "TechZone",
          rating: 4.8,
          reviewCount: 1200,
          sold: 800,
          stock: 12,
        },
      ],
      totalElements: 1,
    });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProducts(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.id).toBe("srv-1"));

    const item = result.current.data![0];
    expect(item.name).toBe("Tai nghe Sony");
    expect(item.price).toBe(4_990_000);
    expect(item.originalPrice).toBe(5_990_000);
    expect(item.discount).toBe(17);
    expect(item.image).toBe("https://cdn/sony.jpg");
    expect(item.images).toEqual(["https://cdn/sony.jpg"]);
    expect(item.sellerName).toBe("TechZone");
    expect(item.rating).toBe(4.8);
  });

  it("surfaces errors verbatim — callers handle the empty/error state", async () => {
    const err = new ApiError(503, "SERVICE_UNAVAILABLE", "downstream is down");
    productListMock.mockRejectedValue(err);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProducts(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.error).toBe(err));
    expect(result.current.data).toBeUndefined();
  });

  it("returns an empty array when the server returns no content", async () => {
    productListMock.mockResolvedValue({ content: [], totalElements: 0 });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProducts(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(result.current.error).toBeNull();
  });

  it("forwards seller search to the server query", async () => {
    productListMock.mockResolvedValue({ content: [], totalElements: 0 });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(
      () => useProducts({ sellerId: "seller-1", q: "headphones", page: 0, size: 24 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(productListMock).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: "seller-1", q: "headphones", page: 0, size: 24 }),
    );
  });
});

describe("useProduct", () => {
  it("does not call productById when no id is provided", () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProduct(""), { wrapper: Wrapper });
    expect(productByIdMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it("normalises a server detail response", async () => {
    productByIdMock.mockResolvedValue({
      id: "srv-9",
      name: "Áo thun",
      price: 199_000,
      colors: ["Đen", "Trắng"],
      sizes: ["M", "L"],
      description: "Cotton 100%",
      stock: 50,
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProduct("srv-9"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.id).toBe("srv-9"));
    expect(result.current.data?.colors).toEqual(["Đen", "Trắng"]);
    expect(result.current.data?.sizes).toEqual(["M", "L"]);
    expect(result.current.data?.description).toBe("Cotton 100%");
    expect(result.current.data?.discount).toBeUndefined();
  });

  it("propagates 4xx ApiErrors", async () => {
    productByIdMock.mockRejectedValue(new ApiError(404, "PRODUCT_NOT_FOUND", "missing"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProduct("ghost"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect((result.current.error as ApiError).status).toBe(404);
  });

  it("propagates 5xx ApiErrors", async () => {
    productByIdMock.mockRejectedValue(new ApiError(503, "SERVICE_UNAVAILABLE", "down"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProduct("p1"), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect((result.current.error as ApiError).status).toBe(503);
    expect(result.current.data).toBeUndefined();
  });
});
