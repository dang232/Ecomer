import type { Product } from "../types/ui";

export interface BackendSearchCriteria {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: number;
  tags?: string[];
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
  sortBy?: string;
}

const SUPPORTED_SORTS = new Set(["popular", "price-low", "price-high", "newest"]);

export type PriceRangeError =
  "min-negative" | "max-negative" | "min-greater-than-max" | "min-invalid" | "max-invalid";

/**
 * Category-only navigation is a catalog browse, not a full-text search. The
 * product service is authoritative for its complete cursor result set.
 */
export function canUseCatalogBrowse(criteria: BackendSearchCriteria): boolean {
  return Boolean(
    criteria.category?.trim() &&
    !criteria.query?.trim() &&
    !criteria.brand?.trim() &&
    !criteria.minPrice?.trim() &&
    !criteria.maxPrice?.trim() &&
    (criteria.minRating ?? 0) <= 0 &&
    !criteria.tags?.length &&
    !criteria.sameDay &&
    !criteria.verifiedOnly &&
    !criteria.officialOnly,
  );
}

function parseOptionalPrice(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validatePriceRange(min: string, max: string): PriceRangeError | null {
  const minValue = parseOptionalPrice(min);
  const maxValue = parseOptionalPrice(max);

  if (minValue !== null && Number.isNaN(minValue)) return "min-invalid";
  if (maxValue !== null && Number.isNaN(maxValue)) return "max-invalid";
  if (minValue !== null && minValue < 0) return "min-negative";
  if (maxValue !== null && maxValue < 0) return "max-negative";
  if (minValue !== null && maxValue !== null && minValue > maxValue) {
    return "min-greater-than-max";
  }
  return null;
}

export function normalizeSearchSort(value: string | null): string {
  return value && SUPPORTED_SORTS.has(value) ? value : "popular";
}

export function requiresBackendSearch(criteria: BackendSearchCriteria): boolean {
  return Boolean(
    criteria.query?.trim() ||
    criteria.category?.trim() ||
    criteria.brand?.trim() ||
    criteria.minPrice?.trim() ||
    criteria.maxPrice?.trim() ||
    (criteria.minRating ?? 0) > 0 ||
    (criteria.tags?.length ?? 0) > 0 ||
    criteria.sameDay ||
    criteria.verifiedOnly ||
    criteria.officialOnly ||
    (criteria.sortBy && normalizeSearchSort(criteria.sortBy) !== "popular"),
  );
}

export interface SearchFallbackState {
  isLoading: boolean;
  hasError: boolean;
  totalElements: number;
  localCatalogCount: number;
  localCatalogLoading?: boolean;
}

/**
 * The product service is the catalog read model, while search-service is an
 * eventually-consistent index. Use the catalog when the index is healthy but
 * empty and the catalog has data, so a category filter cannot turn into a
 * false empty state during index lag or a visibility mismatch.
 */
export function shouldFallbackToCatalog(state: SearchFallbackState): boolean {
  return (
    !state.isLoading &&
    !state.hasError &&
    state.totalElements === 0 &&
    (state.localCatalogCount > 0 || state.localCatalogLoading === true)
  );
}

/**
 * Search is the source of truth for result ordering, but the catalog can
 * repair media omitted by an eventually-consistent search projection.
 */
export function mergeMissingProductImages(
  products: Product[],
  fallbackProducts: Product[],
): Product[] {
  const fallbackById = new Map(fallbackProducts.map((product) => [product.id, product]));

  return products.map((product) => {
    if (product.image) return product;
    const fallback = fallbackById.get(product.id);
    if (!fallback?.image) return product;

    return {
      ...product,
      image: fallback.image,
      images: product.images.length > 0 ? product.images : fallback.images,
    };
  });
}
