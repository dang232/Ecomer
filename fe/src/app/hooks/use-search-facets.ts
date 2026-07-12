import { useQuery } from "@tanstack/react-query";

import { searchFacets, type SearchFacets } from "../lib/api/endpoints/search";

interface UseSearchFacetsParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
  enabled?: boolean;
}

const EMPTY: SearchFacets = { categories: [], brands: [] };

/**
 * Returns category + brand facet counts for the same filter set used by
 * useSearch / searchProducts. Each axis drops its own filter on the BE so the
 * sidebar can show "x other categories also match" without forcing the user
 * to unselect the current one.
 *
 * Pass enabled=false to skip the network call (e.g. when the search page
 * doesn't have a query yet and is rendering the static welcome state).
 */
export function useSearchFacets(params: UseSearchFacetsParams) {
  const { enabled = true, q, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly } = params;
  const result = useQuery({
    queryKey: ["search", "facets", { q, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly }],
    queryFn: () => searchFacets({ q, category, brand, minPrice, maxPrice, sameDay, verifiedOnly, officialOnly }),
    enabled,
    staleTime: 30_000,
    retry: false,
  });

  return {
    facets: result.data ?? EMPTY,
    isLoading: enabled && result.isLoading,
    error: result.error,
  };
}
