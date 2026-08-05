import { describe, expect, it } from "vitest";

import { summarizeReviews } from "@/features/reviews/model/review-summary";

describe("summarizeReviews", () => {
  it("uses the live reviews to calculate count, average, and distribution", () => {
    expect(summarizeReviews([{ rating: 5 }, { rating: 3 }, { rating: 5 }])).toEqual({
      average: 4.3,
      count: 3,
      distribution: { 1: 0, 2: 0, 3: 1, 4: 0, 5: 2 },
    });
  });

  it("returns an empty summary when there are no live reviews", () => {
    expect(summarizeReviews([])).toEqual({
      average: 0,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });
});
