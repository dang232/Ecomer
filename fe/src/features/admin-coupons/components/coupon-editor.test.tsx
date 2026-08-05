import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { couponFormSchema } from "../model/coupon-form";

import { CouponEditor } from "./coupon-editor";

const { adminCreateCouponMock } = vi.hoisted(() => ({
  adminCreateCouponMock: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        "admin.coupons.dialog.title": "Create new coupon",
        "admin.coupons.dialog.codeLabel": "Coupon code",
        "admin.coupons.dialog.codePlaceholder": "Enter code",
        "admin.coupons.dialog.typeLabel": "Discount type",
        "admin.coupons.dialog.typePercent": "Percent (%)",
        "admin.coupons.dialog.typeFixed": "Fixed amount (₫)",
        "admin.coupons.dialog.valueLabelPercent": "Discount percent",
        "admin.coupons.dialog.valueLabelFixed": "Discount amount",
        "admin.coupons.dialog.minOrderLabel": "Minimum order",
        "admin.coupons.dialog.minOrderPlaceholder": "Optional",
        "admin.coupons.dialog.maxDiscountLabel": "Maximum discount",
        "admin.coupons.dialog.maxDiscountPlaceholder": "Optional cap",
        "admin.coupons.dialog.maxUsesLabel": "Max uses",
        "admin.coupons.dialog.perUserLimitLabel": "Per user limit (optional)",
        "admin.coupons.dialog.validUntilLabel": "Valid until",
        "admin.coupons.dialog.submit": "Create coupon",
        "admin.coupons.dialog.submitting": "Creating...",
        "admin.coupons.dialog.cancel": "Cancel",
        "admin.coupons.dialog.missingCode": "Please enter a coupon code",
      };
      return dict[key] ?? key;
    },
  }),
}));

vi.mock("@/shared/api/endpoints/admin", () => ({
  adminCreateCoupon: adminCreateCouponMock,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

function TestWrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={makeQueryClient()}>{children}</QueryClientProvider>;
}

describe("couponFormSchema refinements", () => {
  it("accepts valid PERCENT <= 100", () => {
    const result = couponFormSchema.safeParse({
      code: "SALE20",
      type: "PERCENT",
      value: 20,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects PERCENT > 100", () => {
    const result = couponFormSchema.safeParse({
      code: "SALE200",
      type: "PERCENT",
      value: 101,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages.some((m) => m.toLowerCase().includes("100") || m.includes("exceed"))).toBe(
      true,
    );
  });

  it("rejects PERCENT <= 0", () => {
    const result = couponFormSchema.safeParse({
      code: "SALE0",
      type: "PERCENT",
      value: 0,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts FIXED with value >= 0", () => {
    const result = couponFormSchema.safeParse({
      code: "FLAT50K",
      type: "FIXED",
      value: 50000,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects FIXED with negative value", () => {
    const result = couponFormSchema.safeParse({
      code: "NEGATIVE",
      type: "FIXED",
      value: -5000,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes code to uppercase", () => {
    const result = couponFormSchema.safeParse({
      code: "  sale20  ",
      type: "PERCENT",
      value: 20,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("SALE20");
  });
});

describe("CouponEditor", () => {
  it("shows localized missing-code feedback when the admin submits an empty form", () => {
    render(
      <TestWrapper>
        <CouponEditor open onClose={vi.fn()} />
      </TestWrapper>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create coupon" }));

    expect(screen.getByText("Please enter a coupon code")).toBeInTheDocument();
    expect(adminCreateCouponMock).not.toHaveBeenCalled();
  });
});
