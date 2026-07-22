import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { searchProductsV2, type CursorSearchParams } from "../lib/api/endpoints/search";

export const searchV2Options = (params: CursorSearchParams, enabled = true) => ({
  queryKey: ["search-v2", params] as const,
  queryFn: ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
    searchProductsV2({ ...params, cursor: pageParam }, signal),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (lastPage: Awaited<ReturnType<typeof searchProductsV2>>) =>
    lastPage.data.hasMore ? (lastPage.data.nextCursor ?? undefined) : undefined,
  placeholderData: keepPreviousData,
  staleTime: 10_000,
  enabled,
});

/** Cursor-aware search hook. React Query deduplicates identical queries and aborts obsolete pages. */
export function useSearchV2(params: CursorSearchParams, enabled = true) {
  return useInfiniteQuery(searchV2Options(params, enabled));
}
