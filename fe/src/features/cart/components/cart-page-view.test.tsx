import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { CartPageView } from "./cart-page-view";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) => {
      if (key === "cart.increaseQuantity") return `Increase ${options?.name}`;
      if (key === "cart.decreaseQuantity") return `Decrease ${options?.name}`;
      if (key === "cart.removeItem") return options?.name ? `Remove ${options.name}` : "Remove";
      return options?.count?.toString() ?? key;
    },
  }),
}));

const view = {
  itemCount: 2,
  subtotalVnd: 50_000,
  groups: [
    {
      sellerId: "seller-1",
      sellerName: "VNShop Store",
      subtotalVnd: 50_000,
      lines: [
        {
          key: "p-1:blue",
          productId: "p-1",
          variantId: "blue",
          name: "Blue headphones",
          priceVnd: 25_000,
          quantity: 2,
          sellerId: "seller-1",
        },
      ],
    },
  ],
};

const props = {
  view,
  shippingFeeVnd: 0,
  couponDiscountVnd: 0,
  coupon: "",
  appliedCoupon: null,
  authenticated: true,
  onQuantityChange: vi.fn(),
  onRemove: vi.fn(),
  onClear: vi.fn(),
  onCouponChange: vi.fn(),
  onApplyCoupon: vi.fn(),
  onRemoveCoupon: vi.fn(),
  onLogin: vi.fn(),
  onCheckout: vi.fn(),
  onContinueShopping: vi.fn(),
};

describe("CartPageView", () => {
  it("disables only the pending cart line", () => {
    render(
      <MemoryRouter>
        <CartPageView {...props} pendingLineKey="p-1:blue" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Increase Blue headphones" })).toBeDisabled();
  });

  it("requires confirmation before it removes a cart line", () => {
    render(
      <MemoryRouter>
        <CartPageView {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Blue headphones" }));
    expect(props.onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(props.onRemove).toHaveBeenCalledWith(expect.objectContaining({ key: "p-1:blue" }));
  });

  it("requires confirmation before it clears the whole cart", () => {
    render(
      <MemoryRouter>
        <CartPageView {...props} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "cart.clear" }));
    expect(props.onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "cart.clearConfirm" }));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });
});
