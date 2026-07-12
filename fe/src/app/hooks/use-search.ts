import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { searchProducts } from "../lib/api/endpoints/search";
import { fromServer } from "../lib/api/product-mapper";
import type { Product } from "../types/ui";

export interface SearchParams {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  size?: number;
  sameDay?: boolean;
  verifiedOnly?: boolean;
  officialOnly?: boolean;
  /** 1-indexed page — caller is responsible for omitting when not paginating */
  page?: number;
}

export const searchOptions = (params: SearchParams) =>
  queryOptions({
    queryKey: ["search", params] as const,
    queryFn: () => searchProducts(params),
    retry: false,
    // Keep the previous successful page visible during refetches so callers
    // don't flicker back to a local mock catalog on every filter change.
    placeholderData: keepPreviousData,
  });

export interface UseSearchResult {
  products: Product[];
  totalElements: number;
  totalPages: number;
  isLoading: boolean;
  /** Raw error from the search endpoint, if any. Callers decide whether to fall back. */
  error: unknown;
}

/** Backend-driven search. Caller is responsible for any local fallback when error is set. */
export function useSearch(params: SearchParams, enabled = true): UseSearchResult {
  // `enabled` is runtime-dependent so it is merged at call-site.
  const query = useQuery({ ...searchOptions(params), enabled });

  const products = (query.data?.content ?? []).map(fromServer);
  const totalElements = query.data?.totalElements ?? products.length;
  const totalPages = query.data?.totalPages ?? 1;

  return {
    products,
    totalElements,
    totalPages,
    isLoading: query.isLoading,
    error: query.error,
  };
}
