import { z } from "zod";

import { sellerRevenuePointSchema, type SellerRevenuePoint } from "../../../types/api";
import { api } from "../client";

/**
 * Seller-scoped analytics from order-service. Currently exposes a daily
 * revenue + order-count series resolved from the JWT principal — admin already
 * has the cross-seller view via the admin dashboard endpoints.
 */
export type { SellerRevenuePoint };

export interface SellerRevenueParams {
  /** Window size in days. Backend clamps to 1-365 and defaults to 30. */
  days?: number;
}

export const sellerRevenue = (params: SellerRevenueParams = {}) =>
  api.get("/sellers/me/revenue", z.array(sellerRevenuePointSchema), {
    days: params.days,
  });
