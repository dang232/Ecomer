import { z } from "zod";

/**
 * Seller-scoped analytics from order-service. Currently exposes a daily
 * revenue + order-count series resolved from the JWT principal — admin already
 * has the cross-seller view via the admin dashboard endpoints.
 */
export const sellerRevenuePointSchema = z
  .object({
    date: z.string(),
    revenue: z.number(),
    orderCount: z.number(),
  })
  .passthrough();
export type SellerRevenuePoint = z.infer<typeof sellerRevenuePointSchema>;
