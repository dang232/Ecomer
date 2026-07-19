import { z } from "zod";

import {
  applyCouponResponseSchema,
  buyerCouponSchema,
  validateCouponResponseSchema,
  type BuyerCoupon,
} from "../../../types/api";
import { api } from "../client";

/**
 * Buyer coupon endpoints owned by order-service.
 * Admin-side CRUD lives in `./admin.ts`. Backend is mid-migration (see FE-PLAN §1
 * issue #5 + §5 churn note); we use loose schemas so server-side renames don't
 * crash the UI.
 */

/** Re-exported under the historical name for callers that imported `Coupon`
 * from this module. The buyer surface accepts either string or number ids. */
export type Coupon = BuyerCoupon;

/** Public list of currently active coupons. */
export const listActiveCoupons = () =>
  api.get("/coupons", z.array(buyerCouponSchema), undefined, { auth: false });

/**
 * Pre-apply validation. Backend exposes both `/coupons/validate` and the
 * checkout-prefixed alias `/checkout/validate-coupon`; we hit the canonical
 * coupon path here. `checkout.ts#validateCoupon` keeps the checkout alias for
 * callers already wired to that surface.
 */
export const validateCouponCode = (body: { code: string; orderAmount?: number }) =>
  api.post("/coupons/validate", validateCouponResponseSchema, body);

/** Quote-only preview. Coupon usage is consumed atomically by order placement. */
export const applyCoupon = (body: { code: string; orderAmount: number; orderId?: number }) =>
  api.post("/checkout/apply-coupon", applyCouponResponseSchema, body);
