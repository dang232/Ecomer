import { describe, expect, it } from "vitest";

import { couponFormSchema } from "../model/coupon-form";

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
    expect(messages.some((m) => m.toLowerCase().includes("100") || m.includes("exceed"))).toBe(true);
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

  it("accepts FREE_SHIPPING with value 0", () => {
    const result = couponFormSchema.safeParse({
      code: "FREESHIP",
      type: "FREE_SHIPPING",
      value: 0,
      maxUses: 100,
      validUntil: "2026-12-31T23:59:59.000Z",
    });
    expect(result.success).toBe(true);
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
