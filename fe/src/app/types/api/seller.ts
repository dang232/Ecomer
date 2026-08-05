import { z } from "zod";

import { pageSchema, type Page } from "./shared";

const maskedPayoutDestinationSchema = z
  .object({
    destinationId: z.string(),
    bankName: z.string(),
    last4: z.string(),
    verificationState: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED", "LEGACY_MIGRATED"]),
  })
  .nullable();

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
  .passthrough()
  .transform((raw) => {
    const { bankAccount: _stripped, ...safe } = raw;
    return safe;
  });
export type SellerProfile = z.infer<typeof sellerProfileSchema>;

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
