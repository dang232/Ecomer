import { useQuery } from "@tanstack/react-query";

import { reviewsByProduct } from "../lib/api/endpoints/reviews";
import type { Review } from "../types/api";

export const productReviewsQueryKey = (productId: string) =>
  ["catalog", "reviews", "product", productId] as const;

export function useProductReviews(productId: string) {
  return useQuery<Review[]>({
    queryKey: productReviewsQueryKey(productId),
    queryFn: () => reviewsByProduct(productId),
    enabled: !!productId,
  });
}
