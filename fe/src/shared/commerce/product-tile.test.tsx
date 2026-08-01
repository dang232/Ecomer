import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { ProductTile, type ProductTileView } from "./product-tile";

const product: ProductTileView = {
  id: "product-1",
  name: "A very long Vietnamese product name that must wrap without moving actions",
  imageUrl: "",
  priceVnd: 1_250_000,
  originalPriceVnd: 1_500_000,
  rating: 4.8,
  soldCount: 2300,
  sellerName: "VNShop Mall",
  stockState: "in-stock",
};

function renderTile(view: ProductTileView, href = "/product/product-1") {
  return render(
    <MemoryRouter>
      <ProductTile product={view} href={href} />
    </MemoryRouter>,
  );
}

describe("ProductTile", () => {
  it("renders trustworthy commerce data without resizing the tile", () => {
    renderTile(product);

    expect(screen.getByRole("link", { name: /very long vietnamese/i })).toHaveAttribute(
      "href",
      "/product/product-1",
    );
    expect(screen.getByText("VNShop Mall")).toBeVisible();
    expect(screen.getByText(/17%/)).toBeVisible();
    expect(screen.getByTestId("product-card").className).toContain("grid-rows-");
  });

  it("marks unavailable products and omits unsupported actions", () => {
    renderTile({ ...product, stockState: "unavailable" });

    expect(screen.getByText(/unavailable/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /add to cart/i })).not.toBeInTheDocument();
  });
});
