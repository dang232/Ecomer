import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { productListV2, type ProductListV2Params } from "../lib/api/endpoints/products";
import { catalogV2Enabled } from "../lib/api/catalog-flags";

export const productV2Options = (params: ProductListV2Params, enabled = true) => ({
  queryKey: ["products-v2", params] as const,
  queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
    productListV2({ ...params, cursor: pageParam }, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: Awaited<ReturnType<typeof productListV2>>) =>
    lastPage.data.hasMore ? lastPage.data.nextCursor ?? undefined : undefined,
  placeholderData: keepPreviousData,
  staleTime: 30_000,
  enabled: enabled && catalogV2Enabled,
});

/** Cursor-aware product catalog hook. The legacy product hook remains unchanged. */
export function useProductsV2(params: ProductListV2Params = {}, enabled = true) {
  return useInfiniteQuery(productV2Options(params, enabled));
}
