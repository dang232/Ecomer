import { z } from "zod";

import { api } from "../client";

/**
 * Recommendations-service endpoints (BE-PLAN: services/recommendations-service / 8094).
 *
 * <p>Both endpoints are public reads — no auth header is sent. The shape
 * matches a subset of {@code productSummarySchema} so the FE recommendation
 * cards can render with the same primitives as the catalog grid.
 */

const recommendationItemSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    image: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    originalPrice: z.number().nullable().optional(),
    sellerId: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    rating: z.number().nullable().optional(),
    sold: z.number().nullable().optional(),
  })
  .loose();

export type RecommendationItem = z.infer<typeof recommendationItemSchema>;

export const recommendationItemsSchema = z.array(recommendationItemSchema);

const FBT_DEFAULT_LIMIT = 4;
const YMAL_DEFAULT_LIMIT = 8;

export const frequentlyBoughtTogether = (productId: string, limit: number = FBT_DEFAULT_LIMIT) =>
  api.get(
    "/recommendations/frequently-bought-together",
    recommendationItemsSchema,
    { productId, limit },
    { auth: false },
  );

export const youMayAlsoLike = (productId: string, limit: number = YMAL_DEFAULT_LIMIT) =>
  api.get(
    "/recommendations/you-may-also-like",
    recommendationItemsSchema,
    { productId, limit },
    { auth: false },
  );
