import { z } from "zod";

import { productIdSchema } from "./branded-ids";

// BE review-service / product-service ReviewResponse(reviewId, productId,
// buyerId, userName, userAvatarUrl, orderId, rating, text, images,
// verifiedPurchase, helpfulVotes, status, rejectionReason, createdAt). FE consumers use
// review.id, review.userId, review.userName, review.userAvatarUrl,
// review.comment, review.helpful — aliased through the transform.
export const reviewSchema = z
  .object({
    // Legacy FE-facing names
    id: z.string().optional(),
    userId: z.string().optional(),
    userName: z.string().nullable().optional(),
    userAvatarUrl: z.string().nullable().optional(),
    comment: z.string().optional(),
    helpful: z.number().optional(),
    // Live BE names
    reviewId: z.string().optional(),
    buyerId: z.string().optional(),
    text: z.string().nullable().optional(),
    helpfulVotes: z.number().optional(),
    // BE persists orderId as nullable since V4 (review-from-product-page
    // flow doesn't always have an orderId to attribute the review to).
    // Schema has to accept literal null in addition to undefined.
    orderId: z.string().nullable().optional(),
    verifiedPurchase: z.boolean().optional(),
    status: z.string().optional(),
    rejectionReason: z.string().nullable().optional(),
    productName: z.string().nullable().optional(),
    productId: productIdSchema,
    rating: z.number(),
    images: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
  })
  .passthrough()
  .transform((raw) => ({
    id: raw.id ?? raw.reviewId ?? "",
    productId: raw.productId,
    userId: raw.userId ?? raw.buyerId,
    // userName + userAvatarUrl come from the cross-service lookup
    // (product-service → user-service /users/public-profiles). Either
    // can be null when the buyer has no display name set or when the
    // lookup degrades; consumers MUST fall back to an anonymous label
    // rather than the userId UUID.
    userName: raw.userName ?? null,
    userAvatarUrl: raw.userAvatarUrl ?? null,
    rating: raw.rating,
    comment: raw.comment ?? raw.text,
    images: raw.images,
    helpful: raw.helpful ?? raw.helpfulVotes ?? 0,
    verifiedPurchase: raw.verifiedPurchase,
    status: raw.status,
    rejectionReason: raw.rejectionReason ?? null,
    productName: raw.productName ?? null,
    createdAt: raw.createdAt,
  }));
export type Review = z.infer<typeof reviewSchema>;

export const reviewPageSchema = z
  .object({
    content: z.array(reviewSchema).default([]),
    number: z.number().optional(),
    page: z.number().optional(),
    size: z.number().default(20),
    totalElements: z.number().default(0),
    totalPages: z.number().default(0),
  })
  .passthrough()
  .transform((raw) => ({
    content: raw.content,
    page: raw.page ?? raw.number ?? 0,
    size: raw.size,
    totalElements: raw.totalElements,
    totalPages: raw.totalPages,
  }));
export type ReviewPage = z.infer<typeof reviewPageSchema>;

export const questionSchema = z
  .object({
    id: z.string(),
    productId: productIdSchema,
    userId: z.string().optional(),
    question: z.string(),
    answer: z.string().nullable().optional(),
    answeredAt: z.string().nullable().optional(),
    createdAt: z.string().optional(),
  })
  .passthrough();
export type Question = z.infer<typeof questionSchema>;

/** Pre-signed PUT URL returned by the review image upload endpoint. */
export const reviewImageUploadUrlSchema = z
  .object({ uploadUrl: z.string(), key: z.string().optional() })
  .passthrough();

/** Final CDN URL after activating a previously uploaded review image. */
export const reviewImageActivateSchema = z.object({ url: z.string() }).passthrough();
