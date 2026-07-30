import { z } from "zod";

import { pageSchema, type Page } from "@/shared/contracts/api/shared";

// Masked payout destination — BE returns last4 + verification state only. The
// plaintext account number is NEVER serialized out of the BE and the FE
// contract must not let one sneak back in via .passthrough() on a typed
// destination. Consumers that need a payout destination read the masked
// `last4` for display, never the full number.
export const maskedPayoutDestinationSchema = z
  .object({
    destinationId: z.string(),
    bankName: z.string(),
    last4: z.string(),
    verificationState: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
  })
  .nullable();

// BE SellerProfileResponse(id, shopName, bankName, approved, tier,
// vacationMode, destination). `bankName` is the seller's stated payout bank
// for display in the dashboard; `destination` is the masked card. No
// plaintext bank account number is part of the contract on purpose.
export const sellerProfileSchema = z
  .object({
    id: z.string(),
    shopName: z.string(),
    bankName: z.string().nullable(),
    approved: z.boolean(),
    tier: z.string(),
    vacationMode: z.boolean(),
    destination: maskedPayoutDestinationSchema,
  })
  // .passthrough() lets BE add new fields without breaking the FE, but the
  // plaintext bank account number must NEVER leave the wire — strip it in the
  // transform so a misconfigured BE that returns it cannot leak through a
  // .passthrough() and reach the dashboard. See users.test.ts regression.
  .passthrough()
  .transform((raw) => {
    const { bankAccount: _stripped, ...safe } = raw as Record<string, unknown>;
    return safe;
  });
export type SellerProfile = z.infer<typeof sellerProfileSchema>;
export type MaskedPayoutDestination = z.infer<typeof maskedPayoutDestinationSchema>;

export const publicSellerSchema = z
  .object({
    id: z.string(),
    shopName: z.string(),
    description: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    bannerUrl: z.string().nullable().optional(),
    tier: z.string(),
    joinedAt: z.string(),
    ratingAvg: z.number().nullable().optional(),
    ratingCount: z.number(),
    totalProducts: z.number(),
  })
  .passthrough();

export const publicSellersPageSchema = pageSchema(publicSellerSchema);

export type PublicSeller = z.infer<typeof publicSellerSchema>;
export type PublicSellersPage = Page<PublicSeller>;
