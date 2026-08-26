import { z } from "zod";

import { productIdSchema, sellerIdSchema } from "@/shared/contracts/api/branded-ids";
import { parcelDimensionsSchema } from "@/shared/contracts/api/product";

// BE returns Money as `{ amount: number, currency: string }` (cart-service).
// FE works with bare numbers in VND throughout the cart flow, so we accept
// either shape and normalize.
const moneyToNumber = z.union([
  z.number(),
  z.object({ amount: z.number(), currency: z.string().optional() }).transform((m) => m.amount),
]);

// BE returns `productName` / `productImage` / `unitPrice` / `subtotal` / `addedAt`.
// Map to the legacy FE-internal shape (`name` / `image` / `price`) so existing
// CartPage / Checkout consumers don't need to change.
export const cartItemSchema = z
  .object({
    productId: productIdSchema,
    productName: z.string().optional(),
    productImage: z.string().optional(),
    imageUrl: z.string().optional(),
    unitPrice: moneyToNumber.optional(),
    subtotal: moneyToNumber.optional(),
    quantity: z.number(),
    sellerId: sellerIdSchema.optional(),
    sellerName: z.string().optional(),
    variantId: z.string().nullable().optional(), // BE returns variantId for variant items
    variantSku: z.string().nullable().optional(),
    // Legacy aliases — keep accepting them in case the BE shape regresses.
    name: z.string().optional(),
    image: z.string().optional(),
    price: z.number().optional(),
    parcel: parcelDimensionsSchema.nullable().optional(),
    parcelSnapshot: parcelDimensionsSchema.nullable().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    productId: raw.productId,
    name: raw.name ?? raw.productName,
    image: raw.image ?? raw.productImage ?? raw.imageUrl,
    price: raw.price ?? raw.unitPrice ?? 0,
    quantity: raw.quantity,
    sellerId: raw.sellerId,
    ...(raw.sellerName !== undefined ? { sellerName: raw.sellerName } : {}),
    variantId: raw.variantId ?? raw.variantSku ?? undefined,
    parcel: raw.parcelSnapshot ?? raw.parcel ?? null,
  }));

export const cartSchema = z
  .object({
    userId: z.string().optional(),
    items: z.array(cartItemSchema).default([]),
    itemCount: z.number().optional(),
    uniqueItemCount: z.number().optional(),
    totalAmount: moneyToNumber.optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema> & { variantId?: string };
