import { ChevronLeft, ChevronRight, MessageSquare, Search, Star } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { SellerReviewInboxView } from "../model/review-inbox-view";

const RATING_STARS = ["one", "two", "three", "four", "five"] as const;

export interface ReviewInboxRouteState {
  q: string;
  page: number;
  selected: string | null;
}

interface ReviewInboxProps {
  view: SellerReviewInboxView;
  routeState: ReviewInboxRouteState;
  onRouteChange: (next: Partial<ReviewInboxRouteState>) => void;
}

export function ReviewInbox({ view, routeState, onRouteChange }: ReviewInboxProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState(routeState.q);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRouteChange({ q: search.trim(), page: 0 });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">{t("seller.reviews.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("seller.reviews.subtitle")}</p>
        </div>
        <MessageSquare size={24} className="text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Search form */}
      <form className="flex items-center gap-2" onSubmit={handleSearchSubmit}>
        <Search size={16} className="text-muted-foreground" aria-hidden="true" />
        <input
          role="searchbox"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("seller.reviews.searchPlaceholder")}
          aria-label={t("seller.reviews.searchPlaceholder")}
          className="h-10 flex-1 rounded-lg border border-border bg-card px-3 text-sm text-foreground"
        />
      </form>

      {/* Empty state */}
      {view.reviews.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("seller.reviews.empty")}</p>
        </div>
      ) : null}

      {/* Review list */}
      <div className="space-y-3">
        {view.reviews.map((review) => (
          <article key={review.id} className="bg-card rounded-2xl p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {review.userName ?? t("seller.reviews.anonymous")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {review.productName ?? t("seller.reviews.productFallback")}
                </p>
              </div>
              <div
                className="flex items-center gap-0.5"
                role="img"
                aria-label={`${review.rating}/5`}
              >
                {RATING_STARS.map((star, index) => (
                  <Star
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
            {review.images.length > 0 ? (
              <div className="mt-3 flex gap-2">
                {review.images.map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt={t("seller.reviews.imageAlt")}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                ))}
              </div>
            ) : null}
            {review.createdAt ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </p>
            ) : null}
          </article>
        ))}
      </div>

      {/* Pagination */}
      {view.pageCount > 1 ? (
        <nav
          role="navigation"
          aria-label="pagination"
          className="flex items-center justify-between text-xs text-muted-foreground"
        >
          <button
            type="button"
            onClick={() => onRouteChange({ page: Math.max(routeState.page - 1, 0) })}
            disabled={routeState.page === 0}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            <ChevronLeft size={14} aria-hidden="true" />
            {t("seller.reviews.previous")}
          </button>
          <span>
            {t("seller.reviews.page", { page: routeState.page + 1, pages: view.pageCount })}
          </span>
          <button
            type="button"
            onClick={() => onRouteChange({ page: routeState.page + 1 })}
            disabled={routeState.page + 1 >= view.pageCount}
            className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 disabled:opacity-40"
          >
            {t("seller.reviews.next")}
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}
