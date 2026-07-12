/**
 * Shared product mapper — converts a server ProductSummary or ProductDetail
 * into the UI Product shape used across the app.
 *
 * Extracted from use-products.ts and use-search.ts to eliminate the duplicate
 * implementations and the silent field-drop that existed in the search path.
 */

import type { ProductDetail, ProductSummary } from "../../types/api";
import type { Product } from "../../types/ui";

/** Derive a discount percentage from original and current price. */
export function pct(
  originalPrice: number | undefined,
  price: number | undefined,
): number | undefined {
  if (!originalPrice || !price || originalPrice <= price) return undefined;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/** Pull a usable URL out of an image entry (object shape or plain string). */
function imageUrl(
  entry: ProductSummary["images"] extends (infer T)[] | undefined ? T : never,
): string {
  return typeof entry === "string" ? entry : (entry?.url ?? "");
}

function flattenImages(p: ProductSummary | ProductDetail): string[] {
  const out: string[] = [];
  if (p.images) {
    for (const e of p.images) {
      const url = imageUrl(e);
      if (url) out.push(url);
    }
  }
  if (out.length === 0 && p.image) out.push(p.image);
  return out;
}

/**
 * Extract unique colors and sizes from variant names.
 * Naming pattern: "ProductName Color / Size" — last " / " part = size,
 * second-to-last = color. E.g., "Áo Thun Đỏ / M" → color="Đỏ", size="M".
 */
function parseVariantAttributes(
  variants: ProductSummary["variants"],
): { colors: string[]; sizes: string[] } {
  const colors = new Set<string>();
  const sizes = new Set<string>();
  for (const v of variants ?? []) {
    const parts = (v.name ?? "").split(" / ").map((p) => p.trim());
    if (parts.length >= 2) {
      colors.add(parts[parts.length - 2]); // second-to-last = color
      sizes.add(parts[parts.length - 1]); // last = size
    }
  }
  return { colors: Array.from(colors), sizes: Array.from(sizes) };
}

/**
 * Find a specific variant by its SKU within a product.
 * Returns undefined if no SKU is provided or the variant isn't found.
 * When no SKU is given the caller should use `fromServer` (falls back to variants[0]).
 */
export function findVariant(
  p: ProductSummary | ProductDetail,
  sku: string | undefined,
): { sku?: string; name?: string; priceAmount?: number; imageUrl?: string } | undefined {
  if (!sku) return undefined;
  return p.variants?.find((v) => (v as { sku?: string }).sku === sku);
}

/**
 * Map a server product (summary or detail) into the UI Product shape.
 * Detail-only fields (description, colors, sizes, tags) collapse to their
 * defaults when called with a summary — no fields are silently dropped.
 * The BE returns prices on the first variant (`variants[0].priceAmount`)
 * and not always on a top-level `price`, so we fall through to that.
 * Use {@link findVariant} to resolve the selected variant before calling
 * `fromServer` when you need the price/image of a specific SKU.
 */
export function fromServer(p: ProductSummary | ProductDetail): Product {
  const detail = p as Partial<ProductDetail>;
  const firstVariant = p.variants?.[0];
  const variantPrice = firstVariant?.priceAmount;
  const price = p.price ?? variantPrice ?? 0;
  const images = flattenImages(p);
  const primaryImage = images[0] ?? firstVariant?.imageUrl ?? "";
  const stock = p.stock ?? firstVariant?.stockQuantity ?? 0;
  // BE never sends colors/sizes — derive from variant names as fallback.
  const parsedAttributes = p.variants?.length ? parseVariantAttributes(p.variants) : undefined;
  return {
    id: p.id,
    name: p.name,
    nameEn: p.name,
    price,
    originalPrice: p.originalPrice,
    discount: pct(p.originalPrice, price),
    image: primaryImage,
    images: images.length > 0 ? images : primaryImage ? [primaryImage] : [],
    category: p.category ?? p.categoryId ?? "",
    categoryLabel: p.category ?? p.categoryId ?? "",
    sellerId: p.sellerId ?? "",
    sellerName: p.sellerName ?? "",
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    sold: p.sold ?? 0,
    stock,
    description: detail.description ?? "",
    colors: detail.colors ?? parsedAttributes?.colors, // BE value wins; parsed fallback if absent
    sizes: detail.sizes ?? parsedAttributes?.sizes,    // same fallback logic
    variants: p.variants,
    shipping: "Tiêu chuẩn",
    shippingFee: 0,
    location: "Việt Nam",
    tags: detail.tags ?? [],
    sameDayDelivery: p.sameDayDelivery ?? false,
    verified: p.verified ?? false,
    isOfficial: p.isOfficial ?? false,
  };
}
