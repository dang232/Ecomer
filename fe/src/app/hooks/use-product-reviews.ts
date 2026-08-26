import { useQuery } from "@tanstack/react-query";

import { reviewsByProduct } from "@/shared/api/endpoints/reviews";
import type { ReviewPage } from "@/shared/contracts/api";

export const productReviewsQueryKey = (productId: string, page?: number, size?: number) =>
  page === undefined
    ? (["catalog", "reviews", "product", productId] as const)
    : (["catalog", "reviews", "product", productId, { page, size: size ?? 20 }] as const);

export function useProductReviews(productId: string, page = 0, size = 20) {
  return useQuery<ReviewPage>({
    queryKey: productReviewsQueryKey(productId, page, size),
    queryFn: () => reviewsByProduct(productId, { page, size }),
    enabled: !!productId,
  });
}
