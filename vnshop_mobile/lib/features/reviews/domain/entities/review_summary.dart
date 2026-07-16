import 'package:equatable/equatable.dart';

import 'review.dart';

class ReviewSummary extends Equatable {
  const ReviewSummary({
    required this.average,
    required this.count,
    required this.distribution,
  });

  static const empty = ReviewSummary(
    average: 0,
    count: 0,
    distribution: {1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
  );

  factory ReviewSummary.fromReviews(Iterable<Review> reviews) {
    final distribution = <int, int>{1: 0, 2: 0, 3: 0, 4: 0, 5: 0};
    var total = 0;
    var count = 0;

    for (final review in reviews) {
      final rating = review.rating.clamp(1, 5);
      distribution[rating] = distribution[rating]! + 1;
      total += rating;
      count++;
    }

    return ReviewSummary(
      average: count == 0 ? 0 : (total / count * 10).round() / 10,
      count: count,
      distribution: Map.unmodifiable(distribution),
    );
  }

  final double average;
  final int count;
  final Map<int, int> distribution;

  @override
  List<Object?> get props => [average, count, distribution];
}
