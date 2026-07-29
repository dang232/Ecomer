import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { readJsonText } from "../../shared/api/read-json";
import {
  cursorSearchParamsSchema,
  searchProductsV2,
  type CursorSearchParams,
} from "../lib/api/endpoints/search";

const SEARCH_V2_STALE_TIME = 60_000;

export const searchV2PageOptions = (params: CursorSearchParams, cursor?: string) =>
  queryOptions({
    queryKey: ["search-v2-page", params, cursor] as const,
    queryFn: ({ signal }) => searchProductsV2({ ...params, cursor }, signal),
    staleTime: SEARCH_V2_STALE_TIME,
  });

export const searchV2Options = (
  params: CursorSearchParams,
  client: ReturnType<typeof useQueryClient>,
  enabled = true,
) => ({
  queryKey: ["search-v2", params] as const,
  queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
    client.fetchQuery({
      ...searchV2PageOptions(params, pageParam),
      queryFn: () => searchProductsV2({ ...params, cursor: pageParam }, signal),
    }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: Awaited<ReturnType<typeof searchProductsV2>>) =>
    lastPage.data.hasMore ? (lastPage.data.nextCursor ?? undefined) : undefined,
  placeholderData: keepPreviousData,
  staleTime: SEARCH_V2_STALE_TIME,
  enabled,
});

/** Cursor-aware search hook that keeps one next cursor page warm. */
export function useSearchV2(params: CursorSearchParams, enabled = true) {
  const client = useQueryClient();
  const paramsKey = JSON.stringify(params);
  const stableParams = useMemo(
    () => readJsonText(paramsKey, cursorSearchParamsSchema),
    [paramsKey],
  );
  const query = useInfiniteQuery(searchV2Options(stableParams, client, enabled));
  const lastPage = query.data?.pages.at(-1);
  const nextCursor = lastPage?.data.hasMore ? (lastPage.data.nextCursor ?? undefined) : undefined;

  useEffect(() => {
    if (!enabled || !nextCursor) return;
    void client.prefetchQuery(searchV2PageOptions(stableParams, nextCursor));
  }, [client, enabled, nextCursor, stableParams]);

  return query;
}
