import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProductTile, type ProductTileView } from "./product-tile";

vi.mock("@/shared/api/endpoints/videos", () => ({
  videosByEntity: vi.fn().mockResolvedValue({
    videos: [
      {
        id: "video-1",
        entityId: "product-1",
        context: "PRODUCT",
        status: "PUBLISHED",
        playbackUrl: "/demo.mp4",
        thumbnailUrl: "/demo.jpg",
      },
    ],
  }),
}));

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

  it("previews a published product video on hover even when the product has no image", async () => {
    renderTile({ ...product, imageUrl: "" });

    const link = screen.getByRole("link", { name: /very long vietnamese/i });
    fireEvent.pointerEnter(link, { pointerType: "mouse" });

    await waitFor(() => {
      expect(screen.getByTestId("product-video-preview")).toHaveAttribute("src", "/demo.mp4");
    });
    expect(screen.getByTestId("product-video-preview")).toHaveAttribute("muted");
  });
});
