import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  productReviewsQueryKey,
  useProductReviews,
} from "@/features/reviews/api/use-product-reviews";
import { summarizeReviews, type ReviewSummary } from "@/features/reviews/model/review-summary";
import { ApiError } from "@/shared/api";
import { createReview, voteReviewHelpful } from "@/shared/api/endpoints/reviews";
import type { Review } from "@/shared/contracts/api";

import { resolveAsyncStatus, type AsyncStatus } from "../../shared/ui/async-state-model";

import {
  mergePublishedReview,
  reviewPublicationOutcome,
  type ReviewPublicationOutcome,
} from "./review-view-model";

interface ReviewDraft {
  rating: number;
  comment: string;
}

interface ReviewSubmissionState {
  review: Review;
  outcome: ReviewPublicationOutcome;
}

export interface ProductReviewController {
  reviews: readonly Review[];
  summary: ReviewSummary | undefined;
  status: AsyncStatus;
  error: unknown;
  refetch: () => void;
  draft: ReviewDraft;
  setRating: (rating: number) => void;
  setComment: (comment: string) => void;
  canSubmit: boolean;
  submit: () => Promise<void>;
  isSubmitting: boolean;
  submission: ReviewSubmissionState | null;
  voteHelpful: (reviewId: string) => void;
  votingReviewId: string | null;
}

const INITIAL_DRAFT: ReviewDraft = { rating: 5, comment: "" };

export function useProductReviewController(productId: string): ProductReviewController {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const reviewsQuery = useProductReviews(productId);
  const [draft, setDraft] = useState<ReviewDraft>(INITIAL_DRAFT);
  const [submission, setSubmission] = useState<ReviewSubmissionState | null>(null);

  useEffect(() => {
    setDraft(INITIAL_DRAFT);
    setSubmission(null);
  }, [productId]);

  const createMutation = useMutation({
    mutationFn: (input: ReviewDraft) =>
      createReview({
        productId,
        rating: input.rating,
        comment: input.comment.trim(),
      }),
    onSuccess: (review) => {
      const outcome = reviewPublicationOutcome(review.status);
      setSubmission({ review, outcome });
      setDraft(INITIAL_DRAFT);

      if (outcome === "published") {
        toast.success(
          t("product.reviews.publishedNotice", {
            defaultValue: "Your review is now published.",
          }),
        );
        void queryClient.invalidateQueries({ queryKey: productReviewsQueryKey(productId) });
        return;
      }

      if (outcome === "rejected") {
        toast.error(
          t("product.reviews.rejectedNotice", {
            defaultValue: "Your review could not be published.",
          }),
        );
        return;
      }

      toast.success(t("product.reviews.submitOk"));
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("product.reviews.submitErr")),
  });

  const helpfulMutation = useMutation({
    mutationFn: (reviewId: string) => voteReviewHelpful(reviewId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: productReviewsQueryKey(productId) }),
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : t("product.reviews.voteErr")),
  });

  const reviews = useMemo(() => {
    const published = reviewsQuery.data ?? [];
    return submission ? mergePublishedReview(published, submission.review) : published;
  }, [reviewsQuery.data, submission]);

  const hasReviewData = reviewsQuery.data !== undefined || submission?.outcome === "published";
  const summary = useMemo(
    () => (hasReviewData ? summarizeReviews(reviews) : undefined),
    [hasReviewData, reviews],
  );
  const status = resolveAsyncStatus({
    isLoading: reviewsQuery.isLoading,
    hasError: reviewsQuery.isError,
    isEmpty: hasReviewData && reviews.length === 0,
    hasData: reviews.length > 0,
  });
  const canSubmit = draft.rating >= 1 && draft.rating <= 5 && draft.comment.trim().length > 0;

  return {
    reviews,
    summary,
    status,
    error: reviewsQuery.error,
    refetch: () => {
      void reviewsQuery.refetch();
    },
    draft,
    setRating: (rating) => setDraft((current) => ({ ...current, rating })),
    setComment: (comment) => setDraft((current) => ({ ...current, comment })),
    canSubmit,
    submit: async () => {
      if (!canSubmit || createMutation.isPending) return;
      try {
        await createMutation.mutateAsync(draft);
      } catch {
        // Mutation feedback is handled in onError; callers do not need to catch it.
      }
    },
    isSubmitting: createMutation.isPending,
    submission,
    voteHelpful: (reviewId) => helpfulMutation.mutate(reviewId),
    votingReviewId: helpfulMutation.isPending ? (helpfulMutation.variables ?? null) : null,
  };
}
