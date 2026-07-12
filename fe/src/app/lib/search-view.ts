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
    (criteria.sortBy && criteria.sortBy !== "popular"),
  );
}
