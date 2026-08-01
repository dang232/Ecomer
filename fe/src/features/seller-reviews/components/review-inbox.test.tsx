import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SellerReviewInboxView } from "../model/review-inbox-view";

import { ReviewInbox } from "./review-inbox";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) return key;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

const baseReview = {
  id: "r-1",
  userName: "Alice",
  productName: "Widget",
  rating: 4,
  comment: "Great product!",
  images: [] as string[],
  createdAt: "2026-07-29T10:00:00Z",
};

describe("ReviewInbox", () => {
  it("renders supported search and pagination without a rating filter", () => {
    const view: SellerReviewInboxView = {
      reviews: [{ ...baseReview, rating: 3 }],
      totalCount: 2,
      pageCount: 2,
    };
    render(
      <ReviewInbox
        view={view}
        routeState={{ q: "", page: 0, selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.getByRole("navigation", { name: /pagination/i })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /rating/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });

  it("renders review author, product, rating, comment, media, and date", () => {
    const view: SellerReviewInboxView = {
      reviews: [
        { ...baseReview, comment: "Love it!", rating: 5, userName: "Bob", productName: "Gadget" },
      ],
      totalCount: 1,
      pageCount: 1,
    };
    render(
      <ReviewInbox
        view={view}
        routeState={{ q: "", page: 0, selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Bob")).toBeVisible();
    expect(screen.getByText("Gadget")).toBeVisible();
    expect(screen.getByText("Love it!")).toBeVisible();
    expect(screen.getByRole("img", { name: "5/5" })).toBeVisible();
  });

  it("does not render a reply button", () => {
    const view: SellerReviewInboxView = {
      reviews: [baseReview],
      totalCount: 1,
      pageCount: 1,
    };
    render(
      <ReviewInbox
        view={view}
        routeState={{ q: "", page: 0, selected: null }}
        onRouteChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /reply/i })).not.toBeInTheDocument();
  });
});
