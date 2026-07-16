import { useQuery } from "@tanstack/react-query";

import { productReviewSummaries } from "../lib/api/endpoints/reviews";

export interface ProductReviewSummary {
  average: number | null;
  count: number;
}

export const productReviewSummariesQueryKey = (productIds: string[]) =>
  ["catalog", "reviews", "product-summaries", [...new Set(productIds)].sort()] as const;

export function useProductReviewSummaries(productIds: string[]) {
  const ids = [...new Set(productIds)].filter(Boolean).sort();
  return useQuery({
    queryKey: productReviewSummariesQueryKey(ids),
    queryFn: async () => {
      const response = await productReviewSummaries(ids);
      return Object.fromEntries(
        response.summaries.map((summary) => [
          summary.productId,
          {
            average: summary.ratingAvg,
            count: summary.ratingCount,
          },
        ]),
      );
    },
    enabled: ids.length > 0,
  });
}
