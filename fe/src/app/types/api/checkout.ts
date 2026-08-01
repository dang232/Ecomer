import { z } from "zod";

import { sellerIdSchema } from "./branded-ids";

const sellerBreakdownSchema = z
  .object({
    sellerId: sellerIdSchema,
    sellerName: z.string().optional(),
    subtotal: z.number(),
    shippingFee: z.number().optional(),
  })
  .passthrough();

// BE order-service CheckoutBreakdownResponse(itemsTotal, shippingEstimate,
// discount, finalAmount). FE legacy consumers want subtotal/shippingFee/total.
// Aliased through a transform.
export const calculateCheckoutSchema = z
  .object({
    // Legacy FE-facing names
    subtotal: z.number().optional(),
    shippingFee: z.number().optional(),
    total: z.number().optional(),
    // Live BE names — both shapes accepted simultaneously
    itemsTotal: z.number().optional(),
    shippingEstimate: z.number().optional(),
    finalAmount: z.number().optional(),
    discount: z.number().default(0),
    sellerBreakdown: z.array(sellerBreakdownSchema).optional(),
  })
  .passthrough()
  .transform((raw) => ({
    subtotal: raw.subtotal ?? raw.itemsTotal ?? 0,
    shippingFee: raw.shippingFee ?? raw.shippingEstimate ?? 0,
    discount: raw.discount,
    total: raw.total ?? raw.finalAmount ?? 0,
    sellerBreakdown: raw.sellerBreakdown,
  }));
export type CheckoutCalculation = z.infer<typeof calculateCheckoutSchema>;

export const paymentMethodSchema = z
  .object({
    code: z.string(),
    name: z.string(),
    description: z.string().optional(),
    enabled: z.boolean().default(true),
  })
  .passthrough();

// BE order-service ShippingOptionResponse(method, cost: BigDecimal,
// estimate: string). FE legacy consumers want code/fee/estimatedDays:number.
// estimate is a free-form string ("3-5 days") so we expose it as-is on
// `estimateLabel` for UI consumers and try to parse a leading int into
// estimatedDays for the legacy callers that did arithmetic with it.
function parseEstimateDays(estimate: string | undefined): number | undefined {
  if (!estimate) return undefined;
  const m = /(\d+)/.exec(estimate);
  return m ? Number.parseInt(m[1] ?? "", 10) : undefined;
}

export const shippingOptionSchema = z
  .object({
    sellerId: sellerIdSchema.optional(),
    // Legacy FE-facing names
    code: z.string().optional(),
    fee: z.number().optional(),
    estimatedDays: z.number().optional(),
    // Live BE names
    method: z.string().optional(),
    cost: z.number().optional(),
    estimate: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    sellerId: raw.sellerId,
    code: raw.code ?? raw.method ?? "",
    name: raw.name ?? raw.method ?? "",
    fee: raw.fee ?? raw.cost ?? 0,
    estimatedDays: raw.estimatedDays ?? parseEstimateDays(raw.estimate),
    estimateLabel: raw.estimate ?? undefined,
  }));
