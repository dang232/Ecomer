import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { reviewSchema, type Review } from "../../../app/types/api";
import type { ProductReviewController } from "../use-product-review-controller";

import { ProductReviewsSection } from "./product-reviews-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const value = typeof options?.defaultValue === "string" ? options.defaultValue : key;
      return value.replace(/{{(\w+)}}/g, (_, name: string) => {
        const replacement = options?.[name];
        return typeof replacement === "string" || typeof replacement === "number"
          ? String(replacement)
          : "";
      });
    },
    i18n: { resolvedLanguage: "en-US" },
  }),
}));

vi.mock("../../videos/components/ReviewVideoDisplay", () => ({
  ReviewVideoDisplay: () => null,
}));

const review: Review = reviewSchema.parse({
  id: "review-1",
  productId: "00000000-0000-0000-0000-000000000001",
  userName: "Mai Nguyen",
  userAvatarUrl: null,
  rating: 4,
  comment: "The sound is clear and the fit is comfortable.",
  helpful: 3,
  verifiedPurchase: true,
  status: "APPROVED",
  createdAt: "2026-07-15T10:31:20Z",
});

function controller(overrides: Partial<ProductReviewController> = {}): ProductReviewController {
  return {
    reviews: [review],
    summary: {
      average: 4,
      count: 1,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 0 },
    },
    status: "ready",
    error: null,
    refetch: vi.fn(),
    draft: { rating: 5, comment: "Useful review" },
    setRating: vi.fn(),
    setComment: vi.fn(),
    canSubmit: true,
    submit: vi.fn(),
    isSubmitting: false,
    submission: null,
    voteHelpful: vi.fn(),
    votingReviewId: null,
    ...overrides,
  };
}

describe("ProductReviewsSection", () => {
  it("renders the live summary, a readable date, and verified review content", () => {
    render(<ProductReviewsSection controller={controller()} authenticated onLogin={vi.fn()} />);

    expect(screen.getByTestId("review-summary")).toHaveTextContent("4.0");
    expect(screen.getByText("Jul 15, 2026")).toBeInTheDocument();
    expect(screen.getByText("Verified purchase")).toBeInTheDocument();
    expect(screen.getByText(review.comment!)).toBeInTheDocument();
  });

  it("uses an accessible rating group and labeled comment field", () => {
    const state = controller();
    render(<ProductReviewsSection controller={state} authenticated onLogin={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: "3 stars" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your review" }), {
      target: { value: "Updated comment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit review" }));

    expect(state.setRating).toHaveBeenCalledWith(3);
    expect(state.setComment).toHaveBeenCalledWith("Updated comment");
    expect(state.submit).toHaveBeenCalledTimes(1);
  });

  it("renders a retryable error instead of a false empty state", () => {
    const retry = vi.fn();
    render(
      <ProductReviewsSection
        controller={controller({
          reviews: [],
          summary: undefined,
          status: "error",
          error: new Error("offline"),
          refetch: retry,
        })}
        authenticated={false}
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByText("Reviews could not be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["pending", "Waiting for moderation"],
    ["rejected", "Review not published"],
  ] as const)("shows the %s submission state", (outcome, label) => {
    render(
      <ProductReviewsSection
        controller={controller({ submission: { review, outcome } })}
        authenticated
        onLogin={vi.fn()}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
