import { z } from "zod";

import { productIdSchema } from "./branded-ids";

/**
 * Inventory-service flash-sale schemas (FE-PLAN §2 inventory-service / 8083).
 * Reservations are produced by `/flash-sale/reserve`; stock is the per-product
 * Redis-backed counter; campaigns are the home-page surface.
 */

export const reserveFlashSaleResponseSchema = z
  .object({
    reservationId: z.string(),
    status: z.string(),
    expiresAt: z.string().optional().nullable(),
  })
  .passthrough();
export type FlashSaleReservation = z.infer<typeof reserveFlashSaleResponseSchema>;

export const flashSaleStockResponseSchema = z
  .object({
    productId: productIdSchema,
    stock: z.number(),
  })
  .passthrough();

/**
 * Enriched active flash-sale campaign from inventory-service. Matches Shopee's
 * flash_sale_get_items response shape — includes seller info, discount labels,
 * image hash (resolved via cdnUrl()), and shop badges so the FE can render
 * the full card without a second product-service call.
 */
export const activeFlashSaleCampaignSchema = z
  .object({
    id: z.string(),
    productId: productIdSchema,
    originalPrice: z.number(),
    salePrice: z.number(),
    stockTotal: z.number(),
    stockRemaining: z.number().nullable().optional(),
    endsAt: z.string(),
    name: z.string().nullable().optional(),
    shopName: z.string().nullable().optional(),
    isShopOfficial: z.boolean().optional(),
    isShopPreferred: z.boolean().optional(),
    rawDiscount: z.number().optional(),
    discount: z.string().nullable().optional(),
    imageHash: z.string().nullable().optional(),
  })
  .passthrough();
export type ActiveFlashSaleCampaign = z.infer<typeof activeFlashSaleCampaignSchema>;
