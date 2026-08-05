import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { reviewSchema, type Review } from "@/shared/contracts/api";
import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useProductReviewController } from "./use-product-review-controller";

type UnknownCall = (...args: unknown[]) => unknown;
type UnknownVoidCall = (...args: unknown[]) => void;

const mocks = vi.hoisted(() => ({
  createReview: vi.fn<UnknownCall>(),
  reviewsByProduct: vi.fn<UnknownCall>(),
  voteReviewHelpful: vi.fn<UnknownCall>(),
  toastError: vi.fn<UnknownVoidCall>(),
  toastSuccess: vi.fn<UnknownVoidCall>(),
}));

vi.mock("@/shared/api/endpoints/reviews", () => ({
  createReview: mocks.createReview,
  reviewsByProduct: mocks.reviewsByProduct,
  voteReviewHelpful: mocks.voteReviewHelpful,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => options?.defaultValue ?? key,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

const PRODUCT_ID = "00000000-0000-0000-0000-000000000001";

function review(overrides: Record<string, unknown> = {}): Review {
  return reviewSchema.parse({
    reviewId: "review-1",
    productId: PRODUCT_ID,
    buyerId: "buyer-1",
    rating: 5,
    text: "Clear sound",
    helpfulVotes: 0,
    status: "APPROVED",
    createdAt: "2026-07-15T10:31:20Z",
    ...overrides,
  });
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("useProductReviewController", () => {
  it("adds an approved submission to the visible list and live summary immediately", async () => {
    const existing = review({ reviewId: "existing", rating: 3 });
    const published = review({ reviewId: "published", rating: 5, text: "Excellent" });
    mocks.reviewsByProduct.mockResolvedValue([existing]);
    mocks.createReview.mockResolvedValue(published);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProductReviewController(PRODUCT_ID), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.setRating(5);
      result.current.setComment("  Excellent  ");
    });
    expect(result.current.canSubmit).toBe(true);
    await act(async () => result.current.submit());

    expect(mocks.createReview).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      rating: 5,
      comment: "Excellent",
    });
    expect(result.current.submission?.outcome).toBe("published");
    expect(result.current.reviews.map(({ id }) => id)).toEqual(["published", "existing"]);
    expect(result.current.summary).toMatchObject({ count: 2, average: 4 });
  });

  it("keeps a pending submission out of the public review list", async () => {
    mocks.reviewsByProduct.mockResolvedValue([]);
    mocks.createReview.mockResolvedValue(review({ reviewId: "pending", status: "PENDING" }));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useProductReviewController(PRODUCT_ID), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("empty"));

    act(() => result.current.setComment("Needs moderation"));
    await act(async () => result.current.submit());

    expect(result.current.submission?.outcome).toBe("pending");
    expect(result.current.reviews).toEqual([]);
    expect(result.current.status).toBe("empty");
  });
});
