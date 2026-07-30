import {
  IconChevronLeft,
  IconChevronRight,
  IconMessage,
  IconSearch,
  IconStar,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api";
import { sellerReviews } from "@/shared/api/endpoints/reviews";

const RATING_STARS = ["one", "two", "three", "four", "five"];

export function SellerReviews() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(0);
  const reviewsQuery = useQuery({
    queryKey: ["seller", "reviews", appliedSearch, page],
    queryFn: () => sellerReviews({ q: appliedSearch || undefined, page, size: 20 }),
    retry: false,
  });
  const reviewPage = reviewsQuery.data;
  const reviews = reviewPage?.content ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("seller.reviewsTab.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("seller.reviewsTab.subtitle")}</p>
        </div>
        <IconMessage size={24} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search.trim());
          setPage(0);
        }}
      >
        <IconSearch size={16} className="text-muted-foreground" aria-hidden="true" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("seller.reviewsTab.searchPlaceholder")}
          aria-label={t("seller.reviewsTab.searchPlaceholder")}
          className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
        />
      </form>
      {reviewsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("seller.reviewsTab.loading")}</p>
      ) : null}
      {reviewsQuery.error instanceof ApiError ? (
        <p className="text-sm text-red-600 dark:text-red-400">{reviewsQuery.error.message}</p>
      ) : null}
      {!reviewsQuery.isLoading && reviews.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("seller.reviewsTab.empty")}</p>
        </div>
      ) : null}
      <div className="space-y-3">
        {reviews.map((review) => (
          <article key={review.id} className="bg-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {review.userName ?? t("seller.reviewsTab.anonymous")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {review.productName ?? t("seller.reviewsTab.productFallback")}
                </p>
              </div>
              <div className="flex items-center gap-0.5" aria-label={`${review.rating}/5`}>
                {RATING_STARS.map((star, index) => (
                  <IconStar
                    // Decorative fixed-length rating glyphs have no domain id.
                    key={star}
                    size={14}
                    fill={index < review.rating ? "var(--warning)" : "var(--border)"}
                    className={index < review.rating ? "text-amber-400" : "text-gray-200"}
                  />
                ))}
              </div>
            </div>
            {review.comment ? (
              <p className="mt-3 text-sm text-foreground">{review.comment}</p>
            ) : null}
          </article>
        ))}
      </div>
      {reviewPage && reviewPage.totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            <IconChevronLeft size={14} aria-hidden="true" /> {t("seller.reviewsTab.previous")}
          </button>
          <span>
            {t("seller.reviewsTab.page", { page: page + 1, pages: reviewPage.totalPages })}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(current + 1, reviewPage.totalPages - 1))}
            disabled={page + 1 >= reviewPage.totalPages}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            {t("seller.reviewsTab.next")} <IconChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
