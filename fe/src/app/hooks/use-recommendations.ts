import { queryOptions, useQuery } from "@tanstack/react-query";

import {
  frequentlyBoughtTogether,
  youMayAlsoLike,
  type RecommendationItem,
} from "@/shared/api/endpoints/recommendations";

const FBT_DEFAULT_LIMIT = 4;
const YMAL_DEFAULT_LIMIT = 8;

export const fbtOptions = (productId: string | undefined, limit = FBT_DEFAULT_LIMIT) =>
  queryOptions<RecommendationItem[]>({
    queryKey: ["recommendations", "fbt", productId, limit] as const,
    queryFn: () => frequentlyBoughtTogether(productId ?? "", limit),
    enabled: !!productId,
    staleTime: 5 * 60_000,
    retry: false,
  });

export const ymalOptions = (productId: string | undefined, limit = YMAL_DEFAULT_LIMIT) =>
  queryOptions<RecommendationItem[]>({
    queryKey: ["recommendations", "ymal", productId, limit] as const,
    queryFn: () => youMayAlsoLike(productId ?? "", limit),
    enabled: !!productId,
    staleTime: 5 * 60_000,
    retry: false,
  });

/**
 * Co-purchase suggestions for a given product. Returns an empty list when
 * the product has no recorded co-purchases yet (cold start) or the request
 * fails — callers render the section conditionally on length, never an
 * error state, so a missing recommender feels like "no suggestions yet"
 * rather than a broken page.
 */
export function useFrequentlyBoughtTogether(
  productId: string | undefined,
  limit = FBT_DEFAULT_LIMIT,
) {
  return useQuery(fbtOptions(productId, limit));
}

/**
 * Same-category, ±30%-price candidates ranked by sales volume / rating.
 * Replaces the previous client-side filter on ProductPage.
 */
export function useYouMayAlsoLike(productId: string | undefined, limit = YMAL_DEFAULT_LIMIT) {
  return useQuery(ymalOptions(productId, limit));
}
