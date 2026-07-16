import '../../domain/entities/review.dart';
import '../../domain/repositories/review_repository.dart';
import '../datasources/review_remote_datasource.dart';

class ReviewRepositoryImpl implements ReviewRepository {
  const ReviewRepositoryImpl({required this.remoteDataSource});

  final ReviewRemoteDataSource remoteDataSource;

  @override
  Future<List<Review>> getByProduct(String productId) async {
    final reviews = await remoteDataSource.getByProduct(productId);
    return reviews.map((review) => review.toDomain()).toList(growable: false);
  }

  @override
  Future<Review> create({
    required String productId,
    required int rating,
    required String comment,
  }) async {
    final review = await remoteDataSource.create(
      productId: productId,
      rating: rating,
      comment: comment,
    );
    return review.toDomain();
  }

  @override
  Future<Review> voteHelpful(String reviewId) async {
    final review = await remoteDataSource.voteHelpful(reviewId);
    return review.toDomain();
  }
}
