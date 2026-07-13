import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutReviewStep } from "./CheckoutReviewStep";
import type { PaymentOption } from "./types";

/** Realistic i18next mock — returns the key so tests verify the key is used,
 *  and returns the `defaultValue` when one is passed. */
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      if (opts?.defaultValue !== undefined) return opts.defaultValue;
      return key;
    },
  }),
}));

/**
 * P2-3: CheckoutReviewStep shows variant, seller name, and low-stock warning.
 *
 * The review step reads variant / sellerName / stock from cart items at runtime
 * via a cast (the CartItem type doesn't carry these fields). Test items are
 * constructed as plain objects and passed as cartItems.
 */

type TestCartItem = any;

const baseProps = {
  addresses: [],
  selectedAddressIndex: 0,
  shipping: undefined,
  paymentOptions: [] as PaymentOption[],
  selectedPaymentId: "COD" as PaymentOption["id"],
  buyerName: "Mai Nguyen",
  isProcessing: false,
  setStep: vi.fn(),
};

function makeItem(extra: Record<string, unknown>): TestCartItem {
  return {
    productId: "p1",
    name: "Blue T-Shirt",
    price: 100_000,
    quantity: 1,
    image: undefined,
    sellerId: undefined,
    ...extra,
  };
}

describe("CheckoutReviewStep", () => {
  describe("variant display (P2-3)", () => {
    it("shows variant name under product name when variant is present", () => {
      render(
        <CheckoutReviewStep {...baseProps} cartItems={[makeItem({ variant: "Size M / Blue" })]} />,
      );
      expect(screen.getByText("Blue T-Shirt")).toBeInTheDocument();
      expect(screen.getByText("Size M / Blue")).toBeInTheDocument();
    });

    it("does NOT render a variant line when variant is absent", () => {
      render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem({})]} />);
      // Only the product name appears
      expect(screen.getByText("Blue T-Shirt")).toBeInTheDocument();
      expect(screen.queryByText("Size M / Blue")).not.toBeInTheDocument();
    });
  });

  describe("seller name display (P2-3)", () => {
    it("shows seller name under product name", () => {
      render(
        <CheckoutReviewStep
          {...baseProps}
          cartItems={[makeItem({ sellerName: "VNShop Store" })]}
        />,
      );
      expect(screen.getByText("VNShop Store")).toBeInTheDocument();
    });

    it("falls back to 'Unknown seller' when sellerName is absent", () => {
      render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem({})]} />);
      // The mock returns the defaultValue from t("checkout.review.sellerFallback", { defaultValue: "Unknown seller" })
      expect(screen.getByText(/Unknown seller/)).toBeInTheDocument();
    });
  });

  describe("low-stock warning (P2-3)", () => {
    it("shows low-stock warning when stock < quantity", () => {
      // quantity=3, stock=2 → low stock
      render(
        <CheckoutReviewStep {...baseProps} cartItems={[makeItem({ quantity: 3, stock: 2 })]} />,
      );
      // The mock returns the defaultValue "Low stock — only 2 left"
      expect(screen.getByText(/Low stock.*2 left/)).toBeInTheDocument();
    });

    it("does NOT show low-stock warning when stock >= quantity", () => {
      // quantity=2, stock=5 → fine
      render(
        <CheckoutReviewStep {...baseProps} cartItems={[makeItem({ quantity: 2, stock: 5 })]} />,
      );
      expect(screen.queryByText(/Low stock/)).not.toBeInTheDocument();
    });

    it("does NOT show low-stock warning when stock is undefined", () => {
      render(<CheckoutReviewStep {...baseProps} cartItems={[makeItem({})]} />);
      expect(screen.queryByText(/Low stock/)).not.toBeInTheDocument();
    });
  });
});
