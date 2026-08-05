import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { sellerReviews } from "@/shared/api/endpoints/reviews";

import { toSellerReviewRow, type SellerReviewInboxView } from "../model/review-inbox-view";

import { ReviewInbox } from "./review-inbox";

export { ReviewInbox } from "./review-inbox";

export function SellerReviewInboxRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "0");
  const page = isNaN(pageParam) ? 0 : pageParam;

  const reviewsQuery = useQuery({
    queryKey: ["seller", "reviews", { q, page, size: 20 }],
    queryFn: () => sellerReviews({ q: q || undefined, page, size: 20 }),
    retry: false,
  });

  const view: SellerReviewInboxView = useMemo(() => {
    const data = reviewsQuery.data;
    return {
      reviews: (data?.content ?? []).map(toSellerReviewRow),
      totalCount: data?.totalElements ?? 0,
      pageCount: data?.totalPages ?? 0,
    };
  }, [reviewsQuery.data]);

  const handleRouteChange = (next: { q?: string; page?: number; selected?: string | null }) => {
    const params = new URLSearchParams(searchParams);
    if ("q" in next) {
      if (next.q !== undefined) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
    }
    if ("page" in next) {
      if (next.page !== undefined) {
        if (next.page > 0) params.set("page", String(next.page));
        else params.delete("page");
      }
    }
    if ("selected" in next) {
      if (next.selected) params.set("selected", next.selected);
      else params.delete("selected");
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <ReviewInbox
      view={view}
      routeState={{ q, page, selected: null }}
      onRouteChange={handleRouteChange}
    />
  );
}
