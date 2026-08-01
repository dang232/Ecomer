import { z } from "zod";

import { productIdSchema } from "./branded-ids";

const wishlistEntrySchema = z
  .object({
    productId: productIdSchema,
    createdAt: z.string().optional(),
  })
  .passthrough();

export const wishlistResponseSchema = z
  .object({
    productIds: z.array(productIdSchema),
    items: z.array(wishlistEntrySchema),
  })
  .passthrough();
export type WishlistResponse = z.infer<typeof wishlistResponseSchema>;

export const wishlistToggleResponseSchema = z
  .object({
    productId: productIdSchema,
    changed: z.boolean(),
    inWishlist: z.boolean(),
  })
  .passthrough();
export type WishlistToggleResponse = z.infer<typeof wishlistToggleResponseSchema>;

export const wishlistClearResponseSchema = z
  .object({
    removed: z.number(),
  })
  .passthrough();
