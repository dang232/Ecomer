import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  productReviewsQueryKey,
  useProductReviews,
} from "@/features/reviews/api/use-product-reviews";
import type { ReviewSummary } from "@/features/reviews/model/review-summary";
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
  page: number;
  pageSize: number;
  totalPages: number;
  totalElements: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  setPage: (page: number) => void;
}

const INITIAL_DRAFT: ReviewDraft = { rating: 5, comment: "" };
const PAGE_SIZE = 20;

export function useProductReviewController(productId: string): ProductReviewController {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const reviewsQuery = useProductReviews(productId, page, PAGE_SIZE);
  const [draft, setDraft] = useState<ReviewDraft>(INITIAL_DRAFT);
  const [submission, setSubmission] = useState<ReviewSubmissionState | null>(null);

  useEffect(() => {
    setPage(0);
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
    const published = reviewsQuery.data?.content ?? [];
    return page === 0 && submission
      ? mergePublishedReview(published, submission.review)
      : published;
  }, [page, reviewsQuery.data, submission]);

  const hasReviewData = reviewsQuery.data !== undefined || submission?.outcome === "published";
  const summary = useMemo(() => {
    const source = reviewsQuery.data?.summary;
    if (!hasReviewData || !source) return undefined;
    const distribution = {
      1: source.distribution["1"] ?? 0,
      2: source.distribution["2"] ?? 0,
      3: source.distribution["3"] ?? 0,
      4: source.distribution["4"] ?? 0,
      5: source.distribution["5"] ?? 0,
    };
    if (
      page === 0 &&
      submission &&
      reviewPublicationOutcome(submission.review.status) === "published"
    ) {
      const rating = Math.min(5, Math.max(1, Math.round(submission.review.rating))) as
        1 | 2 | 3 | 4 | 5;
      distribution[rating] += 1;
      const count = source.count + 1;
      const total = Object.entries(distribution).reduce(
        (sum, [value, amount]) => sum + Number(value) * amount,
        0,
      );
      return { average: Math.round((total / count) * 10) / 10, count, distribution };
    }
    return {
      average: source.average ?? 0,
      count: source.count,
      distribution,
    };
  }, [hasReviewData, page, reviewsQuery.data?.summary, submission]);
  const status = resolveAsyncStatus({
    isLoading: reviewsQuery.isLoading,
    hasError: reviewsQuery.isError,
    isEmpty: hasReviewData && reviews.length === 0 && !reviewsQuery.isPlaceholderData,
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
    page,
    pageSize: PAGE_SIZE,
    totalPages: reviewsQuery.data?.totalPages ?? 0,
    totalElements: reviewsQuery.data?.totalElements ?? 0,
    hasPreviousPage: page > 0,
    hasNextPage: page + 1 < (reviewsQuery.data?.totalPages ?? 0),
    setPage,
  };
}
