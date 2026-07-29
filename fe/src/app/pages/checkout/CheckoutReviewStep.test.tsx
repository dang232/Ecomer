import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { cartItemSchema, type CartItem } from "../../types/api";

import { CheckoutReviewStep } from "./CheckoutReviewStep";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

type ReviewProps = Omit<ComponentProps<typeof CheckoutReviewStep>, "cartItems">;

const baseProps: ReviewProps = {
  addresses: [],
  selectedAddressIndex: 0,
  shipping: undefined,
  paymentOptions: [],
  selectedPaymentId: "COD",
  buyerName: "Mai Nguyen",
  isProcessing: false,
  setStep: vi.fn(),
};

function makeItem(extra: Record<string, unknown> = {}): CartItem {
  return cartItemSchema.parse({
    productId: "p1",
    name: "Blue T-Shirt",
    price: 100_000,
    quantity: 1,
    image: undefined,
    sellerId: undefined,
    ...extra,
  });
}

describe("CheckoutReviewStep", () => {
  it("shows the cart-service variant identifier under the product name", () => {
    render(
      <CheckoutReviewStep {...baseProps} cartItems={[makeItem({ variantId: "Size M / Blue" })]} />,
    );

    expect(screen.getByText("Blue T-Shirt")).toBeInTheDocument();
    expect(screen.getByText("Size M / Blue")).toBeInTheDocument();
  });

  it("does not render a variant line when no variant is present", () => {
    render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem()]} />);

    expect(screen.getByText("Blue T-Shirt")).toBeInTheDocument();
    expect(screen.queryByText("Size M / Blue")).not.toBeInTheDocument();
  });

  it("shows seller name under the product name", () => {
    render(
      <CheckoutReviewStep {...baseProps} cartItems={[makeItem({ sellerName: "VNShop Store" })]} />,
    );

    expect(screen.getByText("VNShop Store")).toBeInTheDocument();
  });

  it("uses the seller fallback when sellerName is absent", () => {
    render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem()]} />);

    expect(screen.getByText("Unknown seller")).toBeInTheDocument();
  });

  it("does not render a stock warning for fields outside the cart contract", () => {
    render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem({ quantity: 3, stock: 2 })]} />);

    expect(screen.queryByText(/Low stock/)).not.toBeInTheDocument();
  });
});
