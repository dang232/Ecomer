import { describe, expect, it } from "vitest";

import { reviewSchema, type Review } from "@/shared/contracts/api";

import {
  formatReviewDate,
  mergePublishedReview,
  reviewPublicationOutcome,
} from "./review-view-model";

function review(overrides: Partial<Review> = {}): Review {
  return reviewSchema.parse({
    id: "review-1",
    productId: "00000000-0000-0000-0000-000000000001",
    userName: "Buyer",
    userAvatarUrl: null,
    rating: 5,
    comment: "Clear sound",
    helpful: 0,
    ...overrides,
  });
}

describe("review publication view model", () => {
  it.each([
    ["APPROVED", "published"],
    ["PENDING", "pending"],
    ["REJECTED", "rejected"],
    [undefined, "pending"],
    ["unexpected", "pending"],
  ] as const)("maps %s to %s", (status, expected) => {
    expect(reviewPublicationOutcome(status)).toBe(expected);
  });

  it("merges an approved response into the public list without duplicates", () => {
    const existing = review({ id: "existing" });
    const published = review({ id: "published", status: "APPROVED" });

    expect(mergePublishedReview([existing], published).map(({ id }) => id)).toEqual([
      "published",
      "existing",
    ]);
    expect(mergePublishedReview([published], published)).toHaveLength(1);
  });

  it("does not leak pending or rejected responses into the public list", () => {
    const existing = [review({ id: "existing" })];

    expect(mergePublishedReview(existing, review({ status: "PENDING" }))).toBe(existing);
    expect(mergePublishedReview(existing, review({ status: "REJECTED" }))).toBe(existing);
  });
});

describe("formatReviewDate", () => {
  it("formats server timestamps with Intl in the active locale", () => {
    expect(formatReviewDate("2026-07-15T10:31:20Z", "en-US", "UTC")).toBe("Jul 15, 2026");
  });

  it("omits missing or invalid timestamps", () => {
    expect(formatReviewDate(undefined, "en-US", "UTC")).toBeNull();
    expect(formatReviewDate("not-a-date", "en-US", "UTC")).toBeNull();
  });
});
