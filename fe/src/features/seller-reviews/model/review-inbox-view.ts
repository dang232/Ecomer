import type { Review } from "@/shared/contracts/api";

export interface SellerReviewRow {
  id: string;
  userName: string | null;
  productName: string | null;
  rating: number;
  comment: string | null;
  images: readonly string[];
  createdAt: string;
}

export interface SellerReviewInboxView {
  reviews: readonly SellerReviewRow[];
  totalCount: number;
  pageCount: number;
}

export function toSellerReviewRow(review: Review): SellerReviewRow {
  return {
    id: review.id,
    userName: review.userName,
    productName: review.productName,
    rating: review.rating,
    comment: review.comment,
    images: review.images ?? [],
    createdAt: review.createdAt ?? "",
  };
}
