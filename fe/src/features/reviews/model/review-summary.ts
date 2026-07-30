export type ReviewRating = 1 | 2 | 3 | 4 | 5;

export interface ReviewSummary {
  average: number;
  count: number;
  distribution: Record<ReviewRating, number>;
}

interface RatingReview {
  rating: number;
}

export function summarizeReviews(reviews: readonly RatingReview[]): ReviewSummary {
  const distribution: Record<ReviewRating, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  const normalizedRatings = reviews.map(({ rating }) => {
    const normalized = Math.min(5, Math.max(1, Math.round(rating))) as ReviewRating;
    distribution[normalized] += 1;
    return normalized;
  });

  const count = normalizedRatings.length;
  const total = normalizedRatings.reduce((sum, rating) => sum + rating, 0);

  return {
    average: count === 0 ? 0 : Math.round((total / count) * 10) / 10,
    count,
    distribution,
  };
}
