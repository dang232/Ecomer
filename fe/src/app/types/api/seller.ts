import { z } from "zod";

import { pageSchema, type Page } from "./shared";

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
