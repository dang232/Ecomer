import { queryOptions } from "@tanstack/react-query";

import { adminPendingReviews } from "@/shared/api/endpoints/admin";

export const adminReviewsQueryOptions = (params: { q?: string } = {}) =>
  queryOptions({
    queryKey: ["admin", "reviews", "pending", params.q ?? ""],
    queryFn: () => adminPendingReviews({ q: params.q || undefined }),
    retry: false,
  });
