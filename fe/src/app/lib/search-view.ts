export interface BackendSearchCriteria {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
  sortBy?: string;
}

const SUPPORTED_SORTS = new Set(["popular", "price-low", "price-high", "newest"]);

export type PriceRangeError =
  "min-negative" | "max-negative" | "min-greater-than-max" | "min-invalid" | "max-invalid";

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
}

/**
 * The product service is the catalog read model, while search-service is an
 * eventually-consistent index. Use the catalog when the index is healthy but
 * empty and the catalog has data, so a category filter cannot turn into a
 * false empty state during index lag or a visibility mismatch.
 */
export function shouldFallbackToCatalog(state: SearchFallbackState): boolean {
  return (
    !state.isLoading && !state.hasError && state.totalElements === 0 && state.localCatalogCount > 0
  );
}
