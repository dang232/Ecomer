import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CheckoutPaymentStep } from "./CheckoutPaymentStep";
import { toPaymentOptions, type RawPaymentMethod } from "./types";

const t = ((key: string) => key) as unknown as Parameters<typeof toPaymentOptions>[1];

describe("toPaymentOptions", () => {
  it("keeps only enabled server-advertised flows implemented by checkout", () => {
    const methods: RawPaymentMethod[] = [
      { code: "cod", name: "Cash", enabled: true },
      { code: "vnpay", name: "VNPay", enabled: true },
      { code: "momo", name: "MoMo", enabled: false },
      { code: "vietqr", name: "VietQR", enabled: true },
      { code: "stripe", name: "Stripe", enabled: true },
      { code: "paypal", name: "PayPal", enabled: true },
      { code: "sepay", name: "SePay", enabled: true },
      { code: "bank", name: "Bank", enabled: true },
    ];

    expect(toPaymentOptions(methods, t).map((option) => option.id)).toEqual([
      "COD",
      "VNPAY",
      "VIETQR",
      "STRIPE",
      "PAYPAL",
    ]);
  });

  it("does not invent fallback payment methods when capability loading fails", () => {
    expect(toPaymentOptions(undefined, t)).toEqual([]);
  });

  it("shows a blocking alert with no radios when capability loading fails", () => {
    render(
      <CheckoutPaymentStep
        paymentOptions={[]}
        selectedPaymentId="COD"
        setSelectedPaymentId={vi.fn()}
        loadError={new Error("offline")}
      />,
    );

    expect(screen.getByRole("alert")).toBeVisible();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("omits disabled capabilities", () => {
    expect(
      toPaymentOptions([{ code: "COD", name: "Cash", enabled: false }], t),
    ).toEqual([]);
  });
});
