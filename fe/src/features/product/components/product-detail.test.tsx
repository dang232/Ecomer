import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProductDetail } from "./product-detail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

const baseProps: React.ComponentProps<typeof ProductDetail> = {
  view: {
    id: "camera-1",
    title: "Camera Pro",
    media: [{ id: "camera-1-0", url: "", alt: "Camera Pro" }],
    priceVnd: 1_000_000,
    rating: 4.8,
    soldCount: 10,
    stockState: "in-stock",
    variants: [{ sku: "BLACK", label: "Black", available: true }],
    selectedVariant: { sku: "BLACK", stock: 8 },
    seller: { status: "loading" },
    trustCues: [
      { id: "buyer-protection", label: "Buyer protection" },
      { id: "returns", label: "Easy returns" },
      { id: "shipping", label: "Tracked delivery" },
    ],
    actions: { addToCart: true, buyNow: true },
  },
  route: { section: "details", variant: "BLACK" },
  selectedColor: "",
  selectedSize: "",
  quantity: 1,
  loved: false,
  onRouteChange: vi.fn(),
  onQuantityChange: vi.fn(),
  onSelectColor: vi.fn(),
  onSelectSize: vi.fn(),
  onToggleWishlist: vi.fn(),
  onAddToCart: vi.fn(),
  onBuyNow: vi.fn(),
  onContactSeller: vi.fn(),
};

function renderDetail(overrides: Partial<React.ComponentProps<typeof ProductDetail>> = {}) {
  const props = { ...baseProps, ...overrides };
  render(
    <MemoryRouter>
      <ProductDetail {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("ProductDetail", () => {
  it("shows a stable seller skeleton while seller data is pending", () => {
    renderDetail();

    expect(screen.getByTestId("product-seller-skeleton")).toBeInTheDocument();
    for (const button of screen.getAllByRole("button", { name: "Add to cart" })) {
      expect(button).toBeEnabled();
    }
  });

  it("uses URL-owned section changes", () => {
    const props = renderDetail();

    fireEvent.click(screen.getByRole("tab", { name: "Reviews" }));

    expect(props.onRouteChange).toHaveBeenCalledWith({ section: "reviews" });
  });

  it("prevents purchase actions when the selected SKU is unavailable", () => {
    renderDetail({
      view: {
        ...baseProps.view,
        stockState: "unavailable",
        actions: { addToCart: false, buyNow: false },
        selectedVariant: { sku: "BLACK", stock: 0 },
      },
    });

    for (const button of screen.getAllByRole("button", { name: "Add to cart" })) {
      expect(button).toBeDisabled();
    }
    for (const button of screen.getAllByRole("button", { name: "Buy now" })) {
      expect(button).toBeDisabled();
    }
  });
});
