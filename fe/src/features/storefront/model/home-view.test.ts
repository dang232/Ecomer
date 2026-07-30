import { describe, expect, it } from "vitest";

import { toHomeMarketplaceView } from "./home-view";

describe("toHomeMarketplaceView", () => {
  it("uses real product media for the campaign and preserves section truth", () => {
    const view = toHomeMarketplaceView({
      categories: [{ id: "phones", name: "Phones" }],
      flashProducts: [
        {
          id: "p-1",
          name: "Phone Pro",
          image: "https://cdn.example/phone.jpg",
          price: 10_000_000,
          originalPrice: 12_000_000,
        },
      ],
      sellers: [
        {
          id: "s-1",
          shopName: "VNShop Mall",
          tier: "STANDARD",
          joinedAt: "2026-01-01T00:00:00Z",
          ratingAvg: 4.8,
          ratingCount: 120,
          totalProducts: 24,
        },
      ],
      recommendations: [],
      recentlyViewed: [],
    });

    expect(view.campaign).toMatchObject({
      imageUrl: "https://cdn.example/phone.jpg",
      href: "/product/p-1",
    });
    expect(view.sections.recommendations).toBe("empty");
    expect(view.sections.flashSale).toBe("ready");
  });

  it("omits media sections when no supported data exists", () => {
    const view = toHomeMarketplaceView({
      categories: [],
      flashProducts: [],
      sellers: [],
      recommendations: [],
      recentlyViewed: [],
    });

    expect(view.campaign).toBeNull();
    expect(view.liveCommerce).toEqual([]);
  });
});
