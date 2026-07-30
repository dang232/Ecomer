import { createQueryOptions } from "@tanstack/react-query";

import { sellerReviews } from "@/shared/api/endpoints/reviews";

export const sellerReviewKeys = {
  all: ["seller", "reviews"] as const,
  list: (params: { q?: string; page: number; size: number }) =>
    [...sellerReviewKeys.all, "list", params] as const,
};

export const sellerReviewListOptions = (params: { q?: string; page: number; size?: number }) =>
  /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */ createQueryOptions({
    queryKey: sellerReviewKeys.list({ ...params, size: params.size ?? 20 }),
    queryFn: () => sellerReviews({ q: params.q, page: params.page, size: params.size ?? 20 }),
  });
