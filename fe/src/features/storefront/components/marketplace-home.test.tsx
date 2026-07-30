import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "storefront.shortcuts.vouchers": "Vouchers",
        "storefront.shortcuts.label": "Storefront shortcuts",
      })[key] ?? key,
  }),
}));

import { toHomeMarketplaceView } from "../model/home-view";

import { MarketplaceHome } from "./marketplace-home";

const view = toHomeMarketplaceView({
  categories: [{ id: "phones", name: "Phones" }],
  flashProducts: [
    {
      id: "p-1",
      name: "Phone Pro",
      image: "https://cdn.example/phone.jpg",
      price: 10_000_000,
      originalPrice: 12_000_000,
      stock: 3,
    },
  ],
  sellers: [{ id: "s-1", shopName: "VNShop Mall", ratingAvg: 4.8 }],
  recommendations: [
    {
      id: "p-2",
      name: "Camera Kit",
      image: "https://cdn.example/camera.jpg",
      price: 12_000_000,
      stock: 8,
    },
  ],
  recentlyViewed: [],
});

describe("MarketplaceHome", () => {
  it("composes real campaign media, service links, and stable product tiles", () => {
    render(
      <MemoryRouter>
        <MarketplaceHome view={view} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("heading", { name: "Phone Pro" })[0]).toBeVisible();
    expect(screen.getByRole("link", { name: /vouchers/i })).toHaveAttribute("href", "/search");
    expect(screen.getByText("VNShop Mall")).toBeVisible();
    expect(screen.getAllByTestId("product-tile")).toHaveLength(2);
  });
});
