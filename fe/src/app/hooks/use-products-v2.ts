import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { readJsonText } from "../../shared/api/read-json";
import {
  productListV2,
  productListV2ParamsSchema,
  type ProductListV2Params,
} from "@/shared/api/endpoints/products";

const PRODUCT_V2_STALE_TIME = 60_000;

export const productV2PageOptions = (params: ProductListV2Params, cursor?: string) =>
  queryOptions({
    queryKey: ["products-v2-page", params, cursor] as const,
    queryFn: ({ signal }) => productListV2({ ...params, cursor }, signal),
    staleTime: PRODUCT_V2_STALE_TIME,
  });

export const productV2Options = (
  params: ProductListV2Params,
  client: ReturnType<typeof useQueryClient>,
  enabled = true,
) => ({
  queryKey: ["products-v2", params] as const,
  queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
    client.fetchQuery({
      ...productV2PageOptions(params, pageParam),
      queryFn: () => productListV2({ ...params, cursor: pageParam }, signal),
    }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: Awaited<ReturnType<typeof productListV2>>) =>
    lastPage.data.hasMore ? (lastPage.data.nextCursor ?? undefined) : undefined,
  placeholderData: keepPreviousData,
  staleTime: PRODUCT_V2_STALE_TIME,
  enabled,
});

/** Default cursor-aware product catalog hook that keeps one next page warm. */
export function useProductsV2(params: ProductListV2Params = {}, enabled = true) {
  const client = useQueryClient();
  const paramsKey = JSON.stringify(params);
  const stableParams = useMemo(
    () => readJsonText(paramsKey, productListV2ParamsSchema),
    [paramsKey],
  );
  const query = useInfiniteQuery(productV2Options(stableParams, client, enabled));
  const lastPage = query.data?.pages.at(-1);
  const nextCursor = lastPage?.data.hasMore ? (lastPage.data.nextCursor ?? undefined) : undefined;

  useEffect(() => {
    if (!enabled || !nextCursor) return;
    void client.prefetchQuery(productV2PageOptions(stableParams, nextCursor));
  }, [client, enabled, nextCursor, stableParams]);

  return query;
}
