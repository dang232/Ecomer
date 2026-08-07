import { MessageCircle, ShieldCheck, Star, ThumbsUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ReviewVideoDisplay } from "@/features/videos";
import type { Review } from "@/shared/contracts/api";

import { AsyncState } from "../../../shared/ui/async-state";
import { Button } from "../../../shared/ui/button";
import { TextAreaField } from "../../../shared/ui/field";
import { Pagination } from "../../../shared/ui/pagination";
import { Skeleton } from "../../../shared/ui/skeleton";
import { StatusIndicator } from "../../../shared/ui/status-indicator";
import { Surface } from "../../../shared/ui/surface";
import { formatReviewDate } from "../review-view-model";
import type { ProductReviewController } from "../use-product-review-controller";

interface ProductReviewsSectionProps {
  controller: ProductReviewController;
  authenticated: boolean;
  onLogin: () => void;
}

function RatingStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          fill={star <= Math.round(value) ? "var(--rating)" : "transparent"}
          className={star <= Math.round(value) ? "text-rating" : "text-border"}
        />
      ))}
    </span>
  );
}

function ReviewSummary({ summary }: { summary: NonNullable<ProductReviewController["summary"]> }) {
  const { t } = useTranslation();

  return (
    <Surface
      data-testid="review-summary"
      className="grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-center"
    >
      <div className="text-center sm:text-left">
        <p className="text-4xl font-bold text-foreground">{summary.average.toFixed(1)}</p>
        <div className="mt-1 flex justify-center sm:justify-start">
          <RatingStars value={summary.average} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("product.reviewsCount", { count: summary.count })}
        </p>
      </div>

      <div className="grid gap-2">
        {[5, 4, 3, 2, 1].map((rating) => {
          const count = summary.distribution[rating as 1 | 2 | 3 | 4 | 5];
          const percentage = summary.count === 0 ? 0 : Math.round((count / summary.count) * 100);
          return (
            <div
              key={rating}
              className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.75rem] items-center gap-2"
            >
              <span className="text-xs font-medium text-muted-foreground">{rating}</span>
              <div
                role="progressbar"
                aria-label={t("product.reviews.ratingBreakdown", {
                  count: rating,
                  defaultValue: "{{count}} star reviews",
                })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
                className="h-2 overflow-hidden rounded-full bg-surface-elevated"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-right text-xs text-muted-foreground">{percentage}%</span>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function ReviewComposer({ controller }: { controller: ProductReviewController }) {
  const { t } = useTranslation();

  return (
    <Surface>
      <h3 className="text-base font-semibold text-foreground">{t("product.reviews.writeTitle")}</h3>
      <div className="mt-3 grid gap-4">
        <div
          role="radiogroup"
          aria-label={t("product.reviews.ratingLabel", { defaultValue: "Rating" })}
          className="flex flex-wrap gap-1"
        >
          {[1, 2, 3, 4, 5].map((rating) => (
            <Button
              key={rating}
              role="radio"
              aria-checked={rating === controller.draft.rating}
              aria-label={t("product.reviews.ratingOption", {
                count: rating,
                defaultValue: rating === 1 ? "1 star" : "{{count}} stars",
              })}
              variant="ghost"
              size="icon"
              onClick={() => controller.setRating(rating)}
              className="text-rating"
            >
              <Star
                size={22}
                fill={rating <= controller.draft.rating ? "currentColor" : "transparent"}
                aria-hidden="true"
              />
            </Button>
          ))}
        </div>

        <TextAreaField
          id="review-comment"
          label={t("product.reviews.commentLabel", { defaultValue: "Your review" })}
          value={controller.draft.comment}
          onChange={(event) => controller.setComment(event.target.value)}
          placeholder={t("product.reviews.placeholder")}
          maxLength={2_000}
          rows={4}
          required
        />

        <div>
          <Button
            onClick={() => void controller.submit()}
            disabled={!controller.canSubmit}
            pending={controller.isSubmitting}
            pendingLabel={t("product.reviews.submitting")}
          >
            {t("product.reviews.submit", { defaultValue: "Submit review" })}
          </Button>
        </div>
      </div>
    </Surface>
  );
}

function SubmissionNotice({
  submission,
}: {
  submission: NonNullable<ProductReviewController["submission"]>;
}) {
  const { t } = useTranslation();
  const labels = {
    published: t("product.reviews.publishedLabel", { defaultValue: "Published" }),
    pending: t("product.reviews.pendingLabel", { defaultValue: "Waiting for moderation" }),
    rejected: t("product.reviews.rejectedLabel", { defaultValue: "Review not published" }),
  } as const;
  const tones = { published: "success", pending: "warning", rejected: "danger" } as const;

  return (
    <Surface tone="subtle" aria-live="polite" data-testid={`${submission.outcome}-review`}>
      <div className="flex flex-wrap items-center gap-3">
        <StatusIndicator tone={tones[submission.outcome]}>
          {labels[submission.outcome]}
        </StatusIndicator>
        <RatingStars value={submission.review.rating} size={14} />
      </div>
      {submission.review.comment ? (
        <p className="mt-3 break-words text-sm leading-6 text-foreground">
          {submission.review.comment}
        </p>
      ) : null}
    </Surface>
  );
}

function ReviewCard({
  review,
  onHelpful,
  voting,
}: {
  review: Review;
  onHelpful: () => void;
  voting: boolean;
}) {
  const { t, i18n } = useTranslation();
  const date = formatReviewDate(review.createdAt, i18n.resolvedLanguage ?? "vi-VN");
  const name = review.userName ?? t("product.reviews.anonGuest");

  return (
    <Surface className="min-w-0">
      <article>
        <header className="flex min-w-0 items-start gap-3">
          {review.userAvatarUrl ? (
            <img
              src={review.userAvatarUrl}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-sm font-semibold text-muted-foreground"
              aria-hidden="true"
            >
              {name.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="break-words text-sm font-semibold text-foreground">{name}</p>
              {review.verifiedPurchase ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("product.reviews.verifiedPurchase", { defaultValue: "Verified purchase" })}
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RatingStars value={review.rating} size={14} />
              {date ? (
                <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
                  {date}
                </time>
              ) : null}
            </div>
          </div>
        </header>

        {review.comment ? (
          <p className="mt-3 break-words text-sm leading-6 text-foreground">{review.comment}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {review.images?.map((image, index) => (
            <img
              key={`${review.id}-${image}`}
              src={image}
              alt={t("product.reviews.imageAlt", {
                count: index + 1,
                defaultValue: "Review image {{count}}",
              })}
              width={72}
              height={72}
              loading="lazy"
              className="h-[4.5rem] w-[4.5rem] rounded-[var(--radius-control)] border border-border object-cover"
            />
          ))}
          <ReviewVideoDisplay reviewId={review.id} />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onHelpful}
          pending={voting}
          pendingLabel={t("product.reviews.voting", { defaultValue: "Saving" })}
          className="mt-2 text-muted-foreground"
        >
          <ThumbsUp className="h-4 w-4" aria-hidden="true" />
          {t("product.reviews.helpful", { count: review.helpful ?? 0 })}
        </Button>
      </article>
    </Surface>
  );
}

function ReviewListSkeleton() {
  return (
    <div className="grid gap-4" aria-label="Loading reviews">
      {[1, 2].map((item) => (
        <Surface key={item}>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-44 max-w-full" />
            </div>
          </div>
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />
        </Surface>
      ))}
    </div>
  );
}

export function ProductReviewsSection({
  controller,
  authenticated,
  onLogin,
}: ProductReviewsSectionProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="product-reviews-heading" className="grid min-w-0 gap-5">
      <div>
        <h2 id="product-reviews-heading" className="text-xl font-semibold text-foreground">
          {t("product.reviews.sectionTitle", { defaultValue: "Customer reviews" })}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("product.reviews.sectionSubtitle", {
            defaultValue: "Ratings and feedback from shoppers who bought this product.",
          })}
        </p>
      </div>

      {controller.summary && controller.summary.count > 0 ? (
        <ReviewSummary summary={controller.summary} />
      ) : null}

      {authenticated ? (
        <ReviewComposer controller={controller} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
          <p className="text-sm text-muted-foreground">{t("product.reviews.loginToWrite")}</p>
          <Button variant="outline" onClick={onLogin}>
            {t("product.reviews.signIn", { defaultValue: "Sign in" })}
          </Button>
        </div>
      )}

      {controller.submission ? <SubmissionNotice submission={controller.submission} /> : null}

      <AsyncState
        status={controller.status}
        loading={<ReviewListSkeleton />}
        error={
          <div className="py-8">
            <MessageCircle className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">
              {t("product.reviews.errorTitle", { defaultValue: "Reviews could not be loaded" })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("product.reviews.errorSubtitle", {
                defaultValue: "Check your connection and try again.",
              })}
            </p>
          </div>
        }
        empty={
          <div className="border-y border-border py-10 text-center">
            <MessageCircle className="mx-auto h-9 w-9 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 font-semibold text-foreground">
              {t("product.reviews.beFirstTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("product.reviews.beFirstSubtitle")}
            </p>
          </div>
        }
        retry={{
          label: t("product.reviews.retry", { defaultValue: "Try again" }),
          onClick: controller.refetch,
        }}
      >
        <div className="grid gap-4">
          {controller.reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onHelpful={() => controller.voteHelpful(review.id)}
              voting={controller.votingReviewId === review.id}
            />
          ))}
        </div>
        {controller.totalPages > 1 ? (
          <Pagination
            page={controller.page + 1}
            pageCount={controller.totalPages}
            disabled={controller.status === "loading"}
            onPageChange={(nextPage) => controller.setPage(nextPage - 1)}
            labels={{
              navigation: t("product.reviews.pagination", { defaultValue: "Review pages" }),
              previous: t("product.reviews.previousPage", { defaultValue: "Previous page" }),
              next: t("product.reviews.nextPage", { defaultValue: "Next page" }),
              page: (page, pageCount) =>
                t("product.reviews.pageOf", {
                  page,
                  pageCount,
                  defaultValue: "Page {{page}} of {{pageCount}}",
                }),
            }}
          />
        ) : null}
      </AsyncState>
    </section>
  );
}
