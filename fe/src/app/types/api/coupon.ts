import { z } from "zod";

/**
 * Buyer-facing coupon surface.
 *
 * Distinct from {@link import("./admin").couponSchema}: backend is mid-migration
 * (FE-PLAN §1 issue #5 + §5 churn note) and the public list endpoint emits a
 * different shape than the admin CRUD endpoint — `id` may be string or number,
 * `value` and `discountValue` are both observed, expiry uses `validUntil` not
 * `endsAt`. We keep this loose so server-side renames don't crash the UI.
 */
export const buyerCouponSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    code: z.string(),
    type: z.string().optional(),
    discountType: z.string().optional(),
    value: z.number().optional(),
    discountValue: z.number().optional(),
    minOrderValue: z.number().optional(),
    maxDiscount: z.number().optional(),
    validUntil: z.string().optional(),
    active: z.boolean().optional(),
  })
  .passthrough();
export type BuyerCoupon = z.infer<typeof buyerCouponSchema>;

/** Pre-apply validation result. Used by both `/coupons/validate` and
 * `/checkout/validate-coupon`. */
export const validateCouponResponseSchema = z
  .object({
    valid: z.boolean(),
    discount: z.number().optional(),
    message: z.string().optional(),
  })
  .passthrough();

/** Apply (consumes one usage). Returned by `/checkout/apply-coupon`. */
export const applyCouponResponseSchema = z
  .object({
    code: z.string(),
    discount: z.number(),
    finalTotal: z.number().optional(),
  })
  .passthrough();
