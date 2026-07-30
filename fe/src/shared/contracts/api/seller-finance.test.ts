import { describe, expect, it } from "vitest";

import { parsePayoutStatus } from "@/shared/contracts";

import { payoutSchema } from "@/shared/contracts/api/seller-finance";

describe("safe payout response contract", () => {
  it("does not expose a raw payout destination from the response schema", () => {
    const payout = payoutSchema.parse({
      payoutId: "payout-1",
      sellerId: "seller-1",
      amount: 125_000,
      currency: "VND",
      status: "PAID",
      bankAccount: "9704000000000000",
    });

    expect(payout).not.toHaveProperty("bankAccount");
  });

  it.each([
    ["REQUESTED", "REQUESTED"],
    ["APPROVED", "APPROVED"],
    ["SUBMITTING", "SUBMITTING"],
    ["SUBMITTED", "SUBMITTED"],
    ["PAID", "PAID"],
    ["UNKNOWN", "UNKNOWN"],
    ["FAILED", "FAILED"],
    ["REJECTED", "REJECTED"],
    ["CANCELLED", "CANCELLED"],
    ["REVERSED", "REVERSED"],
    ["PENDING", "REQUESTED"],
    ["COMPLETED", "PAID"],
  ])("normalizes %s to canonical status %s", (raw, expected) => {
    expect(parsePayoutStatus(raw)).toBe(expected);
    expect(payoutSchema.parse({ amount: 1, status: raw }).status).toBe(expected);
  });
});
