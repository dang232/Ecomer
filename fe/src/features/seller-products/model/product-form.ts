/**
 * Seller product form schema and mapper.
 *
 * Schema: sellerProductFormSchema — used with zodResolver + React Hook Form.
 * Mapper: toSellerProductWriteBody — injects priceCurrency: 'VND' and maps to the
 * existing SellerProductWriteBody contract (no duplication).
 */

import { z } from "zod";

import type { SellerProductWriteBody } from "@/shared/api/endpoints/products";

// ── Schema ─────────────────────────────────────────────────────────────────────

export const sellerProductFormSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(200),
  description: z.string().trim().max(5_000).default(""),
  categoryId: z.string().trim().min(1, "Category is required"),
  brand: z.string().trim().max(100).default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  images: z
    .array(
      z.object({
        url: z.string().url("Image must be a valid URL"),
        alt: z.string().trim().max(200).optional(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .max(12)
    .default([]),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(1, "SKU is required").max(100),
        name: z.string().trim().min(1, "Variant name is required").max(100),
        priceAmount: z.number().min(0, "Price cannot be negative"),
        stockQuantity: z.number().int().min(0, "Stock cannot be negative"),
        imageUrl: z.string().url().optional(),
      }),
    )
    .min(1, "At least one variant is required"),
});

export type SellerProductForm = z.infer<typeof sellerProductFormSchema>;

// ── Mapper ─────────────────────────────────────────────────────────────────────

/**
 * Maps validated form values to the SellerProductWriteBody endpoint contract.
 * priceCurrency: 'VND' is injected here — the endpoint does not require it on the wire
 * but the BE expects it on the record.
 */
export function toSellerProductWriteBody(
  values: SellerProductForm,
): SellerProductWriteBody {
  return {
    name: values.name,
    description: values.description || undefined,
    categoryId: values.categoryId || undefined,
    brand: values.brand || undefined,
    tags: values.tags.length > 0 ? values.tags : undefined,
    images:
      values.images.length > 0
        ? values.images.map((img, i) => ({ ...img, sortOrder: img.sortOrder ?? i }))
        : undefined,
    variants: values.variants.map((v) => ({
      ...v,
      priceCurrency: "VND",
    })),
  };
}
