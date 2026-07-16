import '../entities/review.dart';

abstract class ReviewRepository {
  Future<List<Review>> getByProduct(String productId);

  Future<Review> create({
    required String productId,
    required int rating,
    required String comment,
  });

  Future<Review> voteHelpful(String reviewId);
}
