import { z } from "zod";

import {
  reviewImageActivateSchema,
  reviewImageUploadUrlSchema,
  reviewPageSchema,
  reviewSchema,
} from "../../../types/api";
import { api } from "../client";

export const reviewsByProduct = (productId: string) =>
  api.get(`/reviews/product/${encodeURIComponent(productId)}`, z.array(reviewSchema), undefined, {
    auth: false,
  });

export interface CreateReviewInput {
  productId: string;
  orderId?: string;
  rating: number;
  comment?: string;
  images?: string[];
}

export const createReview = (body: CreateReviewInput) => api.post("/reviews", reviewSchema, body);

export const voteReviewHelpful = (id: string) =>
  api.put(`/reviews/${encodeURIComponent(id)}/helpful`, reviewSchema);

export const reviewImageUploadUrl = (reviewId: string, body: { contentType: string }) =>
  api.post(
    `/reviews/${encodeURIComponent(reviewId)}/images/upload-url`,
    reviewImageUploadUrlSchema,
    body,
  );

export const sellerReviews = (params: { q?: string; page?: number; size?: number } = {}) =>
  api.get("/reviews/seller/me", reviewPageSchema, {
    q: params.q,
    page: params.page ?? 0,
    size: params.size ?? 20,
  });

export const reviewImageActivate = (reviewId: string, body: { key: string }) =>
  api.post(
    `/reviews/${encodeURIComponent(reviewId)}/images/activate`,
    reviewImageActivateSchema,
    body,
  );
