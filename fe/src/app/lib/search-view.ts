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
