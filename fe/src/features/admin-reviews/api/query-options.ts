import { createQueryOptions } from "@tanstack/react-query";

import { adminPendingReviews } from "@/shared/api/endpoints/admin";

export const adminReviewsQueryOptions = (params: { q?: string } = {}) =>
  createQueryOptions({
    queryKey: ["admin", "reviews", "pending", params.q ?? ""],
    queryFn: () => adminPendingReviews({ q: params.q || undefined }),
    retry: false,
  });