import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutShippingStep } from "./CheckoutShippingStep";

/** Mock i18next: captures the { amount } option so tests can verify the
 *  correct remaining value is passed. */
const amountCapture = { current: "" as string };
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { amount?: string }) => {
      if (opts?.amount !== undefined) {
        amountCapture.current = opts.amount;
        return `REMAINING:${opts.amount}`;
      }
      return key;
    },
  }),
}));

const standardOption = {
  id: "STANDARD",
  name: "Standard Delivery",
  desc: "Delivers in 1-2 days",
  eta: "1-2 days",
  fee: 25_000,
};

// Match the full key so partial substrings in other keys don't false-positive
const FREE_BANNER_KEY = "checkout.shipping.freeShippingBanner";
const REMAINING_KEY = "checkout.shipping.remainingForFreeShipping";

describe("CheckoutShippingStep", () => {
  describe("free-shipping threshold (P2-2)", () => {
    it("shows the freeShippingBanner when subtotal > FREE_SHIPPING_THRESHOLD (600k > 500k)", () => {
      render(
        <CheckoutShippingStep
          shippingOptions={[standardOption]}
          selectedShippingId="STANDARD"
          setShippingChoice={vi.fn()}
          note=""
          setNote={vi.fn()}
          subtotal={600_000}
        />,
      );

      // 600k > 500k → freeShipping = true → banner key rendered
      expect(screen.getByText(new RegExp(`\\b${FREE_BANNER_KEY}\\b`))).toBeInTheDocument();
      // remaining key must NOT appear
      expect(screen.queryByText(new RegExp(`\\b${REMAINING_KEY}\\b`))).not.toBeInTheDocument();
    });

    it("shows the remainingForFreeShipping key when subtotal < threshold (300k < 500k)", () => {
      render(
        <CheckoutShippingStep
          shippingOptions={[standardOption]}
          selectedShippingId="STANDARD"
          setShippingChoice={vi.fn()}
          note=""
          setNote={vi.fn()}
          subtotal={300_000}
        />,
      );

      // 300k < 500k → freeShipping = false → t() is called with { amount }
      // Mock returns "REMAINING:200000.₫"
      expect(screen.getByText(/REMAINING:200/)).toBeInTheDocument();
      // banner key must NOT appear
      expect(screen.queryByText(new RegExp(`\\b${FREE_BANNER_KEY}\\b`))).not.toBeInTheDocument();
    });

    it("passes the correct remaining amount to t() (500k - 300k = 200k)", () => {
      render(
        <CheckoutShippingStep
          shippingOptions={[standardOption]}
          selectedShippingId="STANDARD"
          setShippingChoice={vi.fn()}
          note=""
          setNote={vi.fn()}
          subtotal={300_000}
        />,
      );

      // The mock t() returns "REMAINING:amount"
      expect(screen.getByText(/REMAINING:.*200/)).toBeInTheDocument();
    });

    it("at exactly the threshold (500k), remaining shows 0 amount (strict > condition)", () => {
      render(
        <CheckoutShippingStep
          shippingOptions={[standardOption]}
          selectedShippingId="STANDARD"
          setShippingChoice={vi.fn()}
          note=""
          setNote={vi.fn()}
          subtotal={500_000}
        />,
      );

      // 500000 > 500000 === false → freeShipping = false → remaining shown
      expect(screen.getByText(/REMAINING:.*0/)).toBeInTheDocument();
    });
  });
});
