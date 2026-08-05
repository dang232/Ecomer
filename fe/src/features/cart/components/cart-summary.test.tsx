import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CartSummary } from "./cart-summary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "cart.summaryTitle": "Cart summary",
        "cart.subtotal": "Subtotal",
        "cart.shippingFee": "Shipping",
        "cart.free": "Free",
        "cart.merchandiseTotal": "Merchandise total",
      })[key] ?? key,
  }),
}));

vi.mock("@/shared/lib", () => ({
  formatPrice: (amount: number) => `${amount} VND`,
}));

vi.mock("@/shared/ui", () => ({
  Button: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

describe("CartSummary", () => {
  it("keeps the cart total merchandise-only", () => {
    render(
      <CartSummary
        itemCount={1}
        subtotalVnd={100000}
        shippingFeeVnd={30000}
        couponDiscountVnd={5000}
        coupon=""
        appliedCoupon="SAVE5"
        authenticated
        onCouponChange={vi.fn()}
        onApplyCoupon={vi.fn()}
        onRemoveCoupon={vi.fn()}
        onLogin={vi.fn()}
        onCheckout={vi.fn()}
      />,
    );

    expect(screen.getByText("Merchandise total")).toBeInTheDocument();
    expect(screen.getAllByText("100000 VND")).toHaveLength(2);
    expect(screen.queryByText("125000 VND")).not.toBeInTheDocument();
  });
});
