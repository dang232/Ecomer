import { queryOptions } from "@tanstack/react-query";

import { adminListSellers, adminListSellersCursor } from "@/shared/api/endpoints/admin";

export const adminSellersQueryOptions = (params: { q?: string } = {}) =>
  queryOptions({
    queryKey: ["admin", "sellers", params.q ?? ""],
    queryFn: () => adminListSellers({ q: params.q || undefined }),
    retry: false,
  });

export const adminSellersCursorQueryOptions = (
  params: {
    q?: string;
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryOptions({
    queryKey: [
      "admin",
      "sellers",
      "cursor",
      params.q ?? "",
      params.cursor ?? null,
      params.limit ?? 50,
    ],
    queryFn: () =>
      adminListSellersCursor({
        q: params.q || undefined,
        cursor: params.cursor,
        limit: params.limit ?? 50,
      }),
    retry: false,
  });
