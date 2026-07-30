import { z } from "zod";

export const COUPON_FORM_TYPES = ["PERCENT", "FIXED", "FREE_SHIPPING"] as const;
export type CouponFormType = (typeof COUPON_FORM_TYPES)[number];

/**
 * Zod form schema matching CouponWriteBody, with FREE_SHIPPING added.
 * Refinements enforce:
 * - PERCENT value > 0 and <= 100
 * - FIXED value >= 0
 * - FREE_SHIPPING allows value 0 (discount value is irrelevant for shipping waiver)
 */
export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Code must be at least 3 characters")
      .max(40, "Code must be at most 40 characters")
      .transform((value) => value.toUpperCase()),
    type: z.enum(COUPON_FORM_TYPES),
    value: z.number().min(0),
    minOrderValue: z.number().min(0).optional(),
    maxDiscount: z.number().positive().optional(),
    maxUses: z.number().int().positive(),
    perUserLimit: z.number().int().positive().optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENT") {
      if (data.value <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent value must be greater than 0",
          path: ["value"],
        });
      }
      if (data.value > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          message: "Percent value cannot exceed 100",
          path: ["value"],
        });
      }
    }
    if (data.type === "FIXED") {
      if (data.value < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          message: "Fixed discount cannot be negative",
          path: ["value"],
        });
      }
    }
    if (data.type === "FREE_SHIPPING") {
      // FREE_SHIPPING value is ignored by the backend for shipping waiver;
      // allow 0 but no validation needed
    }
  });

export type CouponFormValues = z.infer<typeof couponFormSchema>;

/** Write body — inferred from schema to avoid drift. */
export type CouponWriteBody = CouponFormValues;
