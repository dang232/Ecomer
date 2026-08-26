import { z } from "zod";

import { productIdSchema, sellerIdSchema } from "@/shared/contracts/api/branded-ids";

export const parcelDimensionsSchema = z
  .object({
    weightGrams: z.number().int().positive(),
    lengthCm: z.number().int().positive(),
    widthCm: z.number().int().positive(),
    heightCm: z.number().int().positive(),
    declaredValueMinor: z.number().int().nonnegative().default(0),
  })
  .strict();
export type ParcelDimensions = z.infer<typeof parcelDimensionsSchema>;

// BE returns image objects ({url, alt, sortOrder}); some other endpoints (e.g.
// search) emit a flat string array or `imageUrl`; legacy demo data sometimes
// ships single `image`. Accept all shapes and let `fromServer` flatten.
const imageEntrySchema = z.union([
  z.string(),
  z
    .object({
      url: z.string(),
      alt: z.string().nullable().optional(),
      sortOrder: z.number().optional(),
    })
    .passthrough(),
]);

// Variants from product-service: priceAmount/priceCurrency/sku/imageUrl/...
const productVariantSchema = z
  .object({
    sku: z.string().optional(),
    name: z.string().optional(),
    priceAmount: z.number().optional(),
    priceCurrency: z.string().optional(),
    imageUrl: z.string().nullable().optional(),
    stockQuantity: z.number().optional(),
    parcel: parcelDimensionsSchema.nullable().optional(),
  })
  .passthrough();

export const productSummarySchema = z
  .object({
    id: productIdSchema,
    name: z.string(),
    price: z.number().optional(),
    originalPrice: z.number().optional(),
    image: z.string().optional(),
    imageUrl: z.string().nullable().optional(),
    images: z.array(imageEntrySchema).optional(),
    variants: z.array(productVariantSchema).optional(),
    category: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    brand: z.string().nullable().optional(),
    sellerId: sellerIdSchema.optional(),
    sellerName: z.string().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    sold: z.number().optional(),
    stock: z.number().optional(),
    sameDayDelivery: z.boolean().optional(),
    verified: z.boolean().optional(),
    isOfficial: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const productDetailSchema = productSummarySchema
  .extend({
    description: z.string().nullable().optional(),
    colors: z.array(z.string()).optional(),
    sizes: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export type ProductSummary = z.infer<typeof productSummarySchema>;
export type ProductDetail = z.infer<typeof productDetailSchema>;

/** Pre-signed PUT URL returned by the seller product image upload endpoint. */
export const productImageUploadUrlSchema = z
  .object({
    uploadUrl: z.string(),
    objectKey: z.string(),
    uploadHeaders: z.record(z.string(), z.string()).default({}),
  })
  .passthrough();

/** Final CDN URL after activating a previously uploaded product image. */
export const productImageActivateSchema = z.object({ url: z.string() }).passthrough();
