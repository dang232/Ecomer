import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/client", () => ({
  api: { get: vi.fn() },
}));

import { api } from "@/shared/api/client";

import { sellerProductById, sellerProductList } from "@/shared/api/endpoints/products";

describe("seller product management endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the authenticated owner-scoped page endpoint without a seller query parameter", async () => {
    const page = { content: [], number: 0, size: 24, totalElements: 0, totalPages: 0 };
    vi.mocked(api.get).mockResolvedValue(page);

    await expect(
      sellerProductList({
        page: 1,
        size: 24,
        q: "draft",
        categoryId: "electronics",
        status: "DRAFT",
      }),
    ).resolves.toEqual(page);

    expect(api.get).toHaveBeenCalledWith(
      "/sellers/me/products",
      expect.anything(),
      {
        page: 1,
        size: 24,
        q: "draft",
        categoryId: "electronics",
        status: "DRAFT",
      },
      { auth: true },
    );
    expect(vi.mocked(api.get).mock.calls[0]?.[2]).not.toHaveProperty("sellerId");
  });

  it("uses the authenticated owner-scoped detail endpoint", async () => {
    const product = { id: "product-1", name: "Draft headphones" };
    vi.mocked(api.get).mockResolvedValue(product);

    await expect(sellerProductById("product-1")).resolves.toEqual(product);

    expect(api.get).toHaveBeenCalledWith(
      "/sellers/me/products/product-1",
      expect.anything(),
      undefined,
      { auth: true },
    );
  });
});
