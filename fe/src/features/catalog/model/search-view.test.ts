import { describe, expect, it } from "vitest";

import { toSearchResultsView } from "./search-view";

const product = {
  id: "product-1",
  name: "Camera Pro",
  nameEn: "Camera Pro",
  price: 2_000_000,
  image: "https://cdn.example/camera.jpg",
  images: ["https://cdn.example/camera.jpg"],
  category: "electronics",
  categoryLabel: "Electronics",
  sellerId: "seller-1",
  sellerName: "Camera Store",
  rating: 4.8,
  reviewCount: 12,
  sold: 32,
  stock: 5,
  description: "Camera",
  shipping: "Standard",
  shippingFee: 0,
  location: "Vietnam",
  tags: [],
} as const;

describe("toSearchResultsView", () => {
  it("distinguishes fallback results from an empty search", () => {
    expect(
      toSearchResultsView({
        query: "camera",
        source: "fallback",
        products: [product],
        total: 1,
        error: null,
      }),
    ).toMatchObject({ status: "partial", source: "fallback", resultCount: 1 });

    expect(
      toSearchResultsView({
        query: "camera",
        source: "primary",
        products: [],
        total: 0,
        error: null,
      }),
    ).toMatchObject({ status: "empty", source: "primary", resultCount: 0 });
  });
});
