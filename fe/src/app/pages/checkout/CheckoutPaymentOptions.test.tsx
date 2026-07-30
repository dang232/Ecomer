import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PaymentMethodOption } from "@/shared/contracts/api";

import { CheckoutPaymentStep } from "./CheckoutPaymentStep";
import { toPaymentOptions } from "./types";

const t = ((key: string) => key) as unknown as Parameters<typeof toPaymentOptions>[1];

describe("toPaymentOptions", () => {
  it("keeps only enabled server-advertised flows implemented by checkout", () => {
    const methods: PaymentMethodOption[] = [
      { id: "cod", name: "Cash", enabled: true },
      { id: "vnpay", name: "VNPay", enabled: true },
      { id: "momo", name: "MoMo", enabled: false },
      { id: "vietqr", name: "VietQR", enabled: true },
      { id: "stripe", name: "Stripe", enabled: true },
      { id: "paypal", name: "PayPal", enabled: true },
      { id: "sepay", name: "SePay", enabled: true },
      { id: "bank", name: "Bank", enabled: true },
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
    expect(toPaymentOptions([{ id: "COD", name: "Cash", enabled: false }], t)).toEqual([]);
  });
});
