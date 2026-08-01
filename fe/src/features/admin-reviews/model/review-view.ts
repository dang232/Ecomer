import type { Review } from "@/shared/contracts/api";

/** UI-facing view of a review in the admin moderation queue. */
export interface ReviewView {
  id: string;
  productId: string;
  productName: string | null;
  userId: string | undefined;
  userName: string | null;
  rating: number;
  comment: string | undefined;
}

export function toReviewView(raw: Review): ReviewView {
  return {
    id: raw.id ?? "",
    productId: raw.productId,
    productName: raw.productName ?? null,
    userId: raw.userId,
    userName: raw.userName ?? null,
    rating: raw.rating,
    comment: raw.comment ?? undefined,
  };
}
