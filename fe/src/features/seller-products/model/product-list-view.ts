/**
 * Typed presenter for the seller product catalog list view.
 *
 * Note: The seller product catalog endpoint returns ACTIVE catalog products only.
 * Deep-linked editing is supported for an ACTIVE row or a session-recovered draft,
 * NOT for an arbitrary unpublished product ID.
 */

import type { Product } from "@/features/catalog";
import type { ProductSummary } from "@/shared/contracts/api";
import { formatPrice } from "@/shared/lib";

/** Row rendered in the product data table. */
export interface ProductListRow {
  id: string;
  name: string;
  image: string | null;
  images: string[];
  publication: "ACTIVE" | "DRAFT";
  priceRange: string;
  priceMin: number;
  priceMax: number;
  stockTotal: number;
  sold: number | null;
}

/** Derive a human-readable price range string from variants. */
function derivePriceRange(
  price: number | undefined,
  variants: ProductSummary["variants"],
): { priceRange: string; priceMin: number; priceMax: number } {
  if (!variants || variants.length === 0) {
    return {
      priceRange: price != null ? formatPrice(price) : "–",
      priceMin: price ?? 0,
      priceMax: price ?? 0,
    };
  }
  const amounts = variants
    .map((v) => v?.priceAmount)
    .filter((a): a is number => a != null);
  if (amounts.length === 0) {
    return {
      priceRange: price != null ? formatPrice(price) : "–",
      priceMin: price ?? 0,
      priceMax: price ?? 0,
    };
  }
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  if (min === max) {
    return { priceRange: formatPrice(min), priceMin: min, priceMax: max };
  }
  return { priceRange: `${formatPrice(min)} – ${formatPrice(max)}`, priceMin: min, priceMax: max };
}

/**
 * Map a Product (from useProducts / fromServer) to a table row.
 * publication reflects the BE shape: ACTIVE rows come from the catalog query;
 * DRAFT rows are recovered from sessionStorage only.
 */
export function toProductListRow(product: Product): ProductListRow {
  const { priceRange, priceMin, priceMax } = derivePriceRange(
    product.price,
    product.variants,
  );
  return {
    id: product.id,
    name: product.name,
    image: product.image ?? null,
    images: product.images,
    publication: "ACTIVE", // catalog query returns ACTIVE only
    priceRange,
    priceMin,
    priceMax,
    stockTotal: product.stock,
    sold: product.sold ?? null,
  };
}
