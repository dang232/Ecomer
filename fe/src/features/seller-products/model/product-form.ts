/**
 * Seller-facing product editor model.
 *
 * Product service persists every sellable offer as a variant, even when a
 * product has no customer-selectable options. The editor keeps that storage
 * detail at the boundary: sellers create either one offer or a collection of
 * options, and this mapper produces the service's variant records.
 */

import { z } from "zod";

import type { SellerProductWriteBody, SellerVariant } from "@/shared/api/endpoints/products";
import { parcelDimensionsSchema, type ParcelDimensions } from "@/shared/contracts/api/product";

export const sellerProductOfferModes = ["single", "variants"] as const;
export type SellerProductOfferMode = (typeof sellerProductOfferModes)[number];

const stockQuantitySchema = z.number().int().min(0, "Stock cannot be negative");

const sellerProductParcelSchema = parcelDimensionsSchema
  .partial()
  .superRefine((parcel, context) => {
    const fields = ["weightGrams", "lengthCm", "widthCm", "heightCm"] as const;
    const hasAnyValue = fields.some((field) => parcel[field] !== undefined);
    if (!hasAnyValue) return;

    fields.forEach((field) => {
      if (parcel[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "Parcel metadata must be complete",
        });
      }
    });
  })
  .transform((parcel) => {
    const hasAnyValue = Object.values(parcel).some((value) => value !== undefined);
    return hasAnyValue ? parcel : undefined;
  });

const sellerProductOfferSchema = z.object({
  /** Optional merchant reference. A service-safe SKU is generated when omitted. */
  sku: z.string().trim().max(100).default(""),
  priceAmount: z.number().positive("Price must be greater than 0"),
  stockQuantity: stockQuantitySchema,
  parcel: sellerProductParcelSchema.optional(),
});

const sellerProductVariantSchema = sellerProductOfferSchema.extend({
  name: z.string().trim().min(1, "Option name is required").max(100),
  imageUrl: z.string().url().optional(),
});

const sellerProductVariantsSchema = z
  .array(sellerProductVariantSchema)
  .max(50, "A product can have at most 50 options")
  .superRefine((variants, context) => {
    const firstIndexBySku = new Map<string, number>();
    variants.forEach((variant, index) => {
      const normalizedSku = variant.sku.trim().toLowerCase();
      if (!normalizedSku) return;
      const firstIndex = firstIndexBySku.get(normalizedSku);
      if (firstIndex !== undefined) {
        context.addIssue({
          code: "custom",
          path: [index, "sku"],
          message: "SKU must be unique",
        });
        context.addIssue({
          code: "custom",
          path: [firstIndex, "sku"],
          message: "SKU must be unique",
        });
      } else {
        firstIndexBySku.set(normalizedSku, index);
      }
    });
  });

export const sellerProductFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(200),
    description: z.string().trim().max(2_000).default(""),
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
      .max(10)
      .default([]),
    offerMode: z.enum(sellerProductOfferModes),
    offer: sellerProductOfferSchema,
    variants: sellerProductVariantsSchema,
  })
  .superRefine((value, context) => {
    if (value.offerMode === "variants" && value.variants.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Add at least one option",
      });
    }
  });

export type SellerProductForm = z.infer<typeof sellerProductFormSchema>;

export const emptySellerProductForm = (): SellerProductForm => ({
  name: "",
  description: "",
  categoryId: "",
  brand: "",
  tags: [],
  images: [],
  offerMode: "single",
  offer: { sku: "", priceAmount: 0, stockQuantity: 0 },
  variants: [],
});

type EditableVariant = {
  sku?: string;
  name?: string;
  priceAmount?: number;
  imageUrl?: string;
  stockQuantity?: number;
  parcel?: ParcelDimensions | null;
};

export interface SellerProductFormSource {
  name: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  tags?: string[];
  images?: (string | { url: string; alt?: string; sortOrder?: number })[];
  variants?: EditableVariant[];
}

/** Convert catalog data into the seller-facing form model. */
export function fromSellerProduct(product: SellerProductFormSource): SellerProductForm {
  const variants = (product.variants ?? [])
    .filter((variant): variant is EditableVariant & { sku: string } => Boolean(variant.sku))
    .map((variant) => ({
      sku: variant.sku,
      name: variant.name?.trim() || "Standard",
      priceAmount: variant.priceAmount ?? 0,
      stockQuantity: variant.stockQuantity ?? 0,
      ...(variant.imageUrl ? { imageUrl: variant.imageUrl } : {}),
      ...(variant.parcel ? { parcel: variant.parcel } : {}),
    }));
  const standardOffer =
    variants.length === 1 && variants[0]?.name === "Standard" ? variants[0] : null;

  return {
    name: product.name,
    description: product.description ?? "",
    categoryId: product.categoryId ?? "",
    brand: product.brand ?? "",
    tags: product.tags ?? [],
    images: (product.images ?? []).map((image, index) =>
      typeof image === "string"
        ? { url: image, sortOrder: index }
        : { ...image, sortOrder: image.sortOrder ?? index },
    ),
    offerMode: standardOffer ? "single" : "variants",
    offer: standardOffer
      ? {
          sku: standardOffer.sku,
          priceAmount: standardOffer.priceAmount,
          stockQuantity: standardOffer.stockQuantity,
          ...(standardOffer.parcel ? { parcel: standardOffer.parcel } : {}),
        }
      : { sku: "", priceAmount: 0, stockQuantity: 0 },
    variants: standardOffer ? [] : variants,
  };
}

/**
 * Restore a pre-v2 draft. Older drafts stored the backend-shaped variants
 * directly, so passing them through the catalog mapper preserves seller work.
 */
export function migrateLegacySellerProductForm(
  product: SellerProductFormSource,
): SellerProductForm {
  return fromSellerProduct(product);
}

function skuToken(value: string, fallback: string): string {
  const token = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
  return token || fallback;
}

function generatedSku(
  productName: string,
  offerName: string,
  index: number,
  usedSkus: Set<string>,
): string {
  const base = `VNS-${skuToken(productName, "PRODUCT").slice(0, 48)}-${skuToken(offerName, "ITEM").slice(0, 32)}-${index + 1}`;
  let candidate = base.slice(0, 100);
  let duplicate = 2;
  while (usedSkus.has(candidate.toLowerCase())) {
    const suffix = `-${duplicate}`;
    candidate = `${base.slice(0, 100 - suffix.length)}${suffix}`;
    duplicate += 1;
  }
  return candidate;
}

function toApiVariant(
  variant: z.infer<typeof sellerProductVariantSchema>,
  productName: string,
  index: number,
  usedSkus: Set<string>,
): SellerVariant {
  const sku = variant.sku.trim() || generatedSku(productName, variant.name, index, usedSkus);
  usedSkus.add(sku.toLowerCase());
  const { parcel: formParcel, ...variantWithoutParcel } = variant;
  const parcel = completeParcel(formParcel);
  return {
    ...variantWithoutParcel,
    sku,
    priceCurrency: "VND",
    ...(parcel ? { parcel } : {}),
  };
}

function completeParcel(
  parcel: z.infer<typeof sellerProductParcelSchema> | undefined,
): ParcelDimensions | undefined {
  const weightGrams = parcel?.weightGrams;
  const lengthCm = parcel?.lengthCm;
  const widthCm = parcel?.widthCm;
  const heightCm = parcel?.heightCm;
  if (
    typeof weightGrams === "number" &&
    Number.isInteger(weightGrams) &&
    weightGrams > 0 &&
    typeof lengthCm === "number" &&
    Number.isInteger(lengthCm) &&
    lengthCm > 0 &&
    typeof widthCm === "number" &&
    Number.isInteger(widthCm) &&
    widthCm > 0 &&
    typeof heightCm === "number" &&
    Number.isInteger(heightCm) &&
    heightCm > 0
  ) {
    return {
      weightGrams,
      lengthCm,
      widthCm,
      heightCm,
    };
  }
  return undefined;
}

/** Map seller-facing values to the product-service write contract. */
export function toSellerProductWriteBody(values: SellerProductForm): SellerProductWriteBody {
  const persistedImages = values.images.filter(
    (image) => !image.url.startsWith("blob:") && !image.url.startsWith("data:"),
  );
  const sourceVariants =
    values.offerMode === "single" ? [{ ...values.offer, name: "Standard" }] : values.variants;
  const usedSkus = new Set<string>();

  return {
    name: values.name,
    description: values.description || undefined,
    categoryId: values.categoryId || undefined,
    brand: values.brand || undefined,
    tags: values.tags.length > 0 ? values.tags : undefined,
    images:
      persistedImages.length > 0
        ? persistedImages.map((image, index) => ({ ...image, sortOrder: image.sortOrder ?? index }))
        : undefined,
    variants: sourceVariants.map((variant, index) =>
      toApiVariant(variant, values.name, index, usedSkus),
    ),
  };
}
