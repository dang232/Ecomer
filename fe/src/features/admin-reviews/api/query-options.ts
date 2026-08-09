import { queryOptions } from "@tanstack/react-query";

import { adminPendingReviews, adminPendingReviewsCursor } from "@/shared/api/endpoints/admin";

export const adminReviewsQueryOptions = (params: { q?: string } = {}) =>
  queryOptions({
    queryKey: ["admin", "reviews", "pending", params.q ?? ""],
    queryFn: () => adminPendingReviews({ q: params.q || undefined }),
    retry: false,
  });

export const adminReviewsCursorQueryOptions = (
  params: {
    q?: string;
    cursor?: string;
    limit?: number;
  } = {},
) =>
  queryOptions({
    queryKey: [
      "admin",
      "reviews",
      "pending",
      "cursor",
      params.q ?? "",
      params.cursor ?? null,
      params.limit ?? 50,
    ],
    queryFn: () =>
      adminPendingReviewsCursor({
        q: params.q || undefined,
        cursor: params.cursor,
        limit: params.limit ?? 50,
      }),
    retry: false,
  });
