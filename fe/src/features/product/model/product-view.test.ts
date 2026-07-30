import { describe, expect, it } from "vitest";

import { toProductDetailView } from "./product-view";

const product = {
  id: "product-1",
  name: "Camera Pro",
  nameEn: "Camera Pro",
  price: 2_000_000,
  originalPrice: 2_400_000,
  image: "https://cdn.example/camera.jpg",
  images: ["https://cdn.example/camera.jpg"],
  category: "electronics",
  categoryLabel: "Electronics",
  sellerId: "seller-1",
  sellerName: "",
  rating: 4.8,
  reviewCount: 12,
  sold: 32,
  stock: 8,
  description: "Camera",
  shipping: "Standard",
  shippingFee: 0,
  location: "Vietnam",
  tags: [],
  variants: [
    { sku: "SKU-BLACK", name: "Black", priceAmount: 2_000_000, stockQuantity: 0 },
    { sku: "SKU-BLUE", name: "Blue", priceAmount: 2_100_000, stockQuantity: 4 },
  ],
} as const;

const publicSeller = {
  id: "seller-1",
  shopName: "Camera Store",
  tier: "STANDARD",
  joinedAt: "2026-01-01T00:00:00Z",
  ratingAvg: 4.8,
  ratingCount: 12,
  totalProducts: 24,
} as const;

describe("toProductDetailView", () => {
  it("exposes only valid purchase actions", () => {
    expect(
      toProductDetailView({ product: { ...product, stock: 0 }, selectedVariant: null }),
    ).toMatchObject({
      stockState: "unavailable",
      actions: { addToCart: false, buyNow: false },
    });
  });

  it("uses a selected variant price, image, and stock", () => {
    const view = toProductDetailView({ product, selectedVariant: "SKU-BLUE" });

    expect(view.selectedVariant).toMatchObject({ sku: "SKU-BLUE", stock: 4 });
    expect(view.priceVnd).toBe(product.variants[1].priceAmount);
  });

  it("joins seller identity only from the decoded public seller response", () => {
    const view = toProductDetailView({
      product,
      seller: { status: "ready", value: publicSeller },
      selectedVariant: null,
    });

    expect(view.seller).toEqual({
      status: "ready",
      id: publicSeller.id,
      name: publicSeller.shopName,
      rating: publicSeller.ratingAvg,
    });
  });
});
