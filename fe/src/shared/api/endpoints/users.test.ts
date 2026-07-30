import { describe, expect, it } from "vitest";

import { sellerProfileSchema, type SellerProfile } from "@/shared/contracts/api/seller";

/**
 * The /sellers/me endpoint returns a SellerProfileResponse that intentionally
 * exposes a masked payout destination only — never a plaintext bank account
 * number. This regression locks in two invariants for the endpoint layer:
 *
 *   1. The wire shape parses through `sellerProfileSchema` without coercion
 *      from the generic `userProfileSchema`.
 *   2. A plaintext `bankAccount` on the response must NOT survive the schema
 *      — if it ever does, we want the test to fail loudly, not silently
 *      leak the number into a UI render.
 *
 * (Sister test in `seller-finance.test.ts` does the same for payouts.)
 */
describe("users endpoint /sellers/me contract", () => {
  const sellerProfileResponse = {
    id: "seller-42",
    shopName: "Mộc Shop",
    bankName: "Vietcombank",
    approved: true,
    tier: "STANDARD",
    vacationMode: false,
    destination: {
      destinationId: "dest-1",
      bankName: "Vietcombank",
      last4: "1234",
      verificationState: "VERIFIED",
    },
  };

  const parse = (payload: unknown): SellerProfile => sellerProfileSchema.parse(payload);

  it("sellerProfileSchema parses the seller dashboard payload", () => {
    const parsed = parse(sellerProfileResponse);
    expect(parsed.id).toBe("seller-42");
    expect(parsed.shopName).toBe("Mộc Shop");
    expect(parsed.destination?.last4).toBe("1234");
    expect(parsed.approved).toBe(true);
  });

  it("sellerProfileSchema does not surface a plaintext bank account number", () => {
    const parsed = parse({
      ...sellerProfileResponse,
      bankAccount: "9704000000000000",
      destination: null,
    });

    expect(parsed).not.toHaveProperty("bankAccount");
    expect(JSON.stringify(parsed)).not.toContain("9704000000000000");
  });

  it("sellerProfileSchema accepts a null destination for sellers without a payout card", () => {
    const parsed = parse({
      ...sellerProfileResponse,
      destination: null,
    });

    expect(parsed.destination).toBeNull();
  });

  it("sellerProfileSchema accepts null bankName for sellers who have not picked a payout bank", () => {
    const parsed = parse({
      ...sellerProfileResponse,
      bankName: null,
    });

    expect(parsed.bankName).toBeNull();
  });
});