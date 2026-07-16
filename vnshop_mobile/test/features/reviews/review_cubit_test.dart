import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/reviews/domain/entities/review.dart';
import 'package:vnshop_mobile/features/reviews/domain/repositories/review_repository.dart';
import 'package:vnshop_mobile/features/reviews/presentation/bloc/review_cubit.dart';
import 'package:vnshop_mobile/features/reviews/presentation/bloc/review_state.dart';

class MockReviewRepository extends Mock implements ReviewRepository {}

void main() {
  const productId = 'product-1';
  late MockReviewRepository repository;

  Review review({
    String id = 'review-1',
    int rating = 4,
    ReviewStatus status = ReviewStatus.approved,
  }) {
    return Review(
      id: id,
      productId: productId,
      buyerId: 'buyer-1',
      userName: 'Mai',
      rating: rating,
      comment: 'Clear sound',
      helpfulVotes: 0,
      verifiedPurchase: true,
      status: status,
      createdAt: DateTime.utc(2026, 7, 15),
    );
  }

  setUp(() {
    repository = MockReviewRepository();
  });

  blocTest<ReviewCubit, ReviewState>(
    'loads published reviews and derives the authoritative summary',
    build: () {
      when(() => repository.getByProduct(productId)).thenAnswer(
        (_) async => [
          review(id: 'one', rating: 3),
          review(id: 'two', rating: 5),
        ],
      );
      return ReviewCubit(repository: repository, productId: productId);
    },
    act: (cubit) => cubit.load(),
    expect: () => [
      isA<ReviewState>().having(
        (state) => state.status,
        'status',
        ReviewViewStatus.loading,
      ),
      isA<ReviewState>()
          .having((state) => state.status, 'status', ReviewViewStatus.ready)
          .having((state) => state.summary.count, 'count', 2)
          .having((state) => state.summary.average, 'average', 4),
    ],
  );

  blocTest<ReviewCubit, ReviewState>(
    'publishes an approved submission immediately and resets the form',
    build: () {
      when(
        () => repository.getByProduct(productId),
      ).thenAnswer((_) async => []);
      when(
        () => repository.create(
          productId: productId,
          rating: 5,
          comment: 'Excellent',
        ),
      ).thenAnswer((_) async => review(id: 'published', rating: 5));
      return ReviewCubit(repository: repository, productId: productId);
    },
    act: (cubit) async {
      await cubit.load();
      cubit.setRating(5);
      cubit.setComment('  Excellent  ');
      await cubit.submit();
    },
    skip: 2,
    expect: () => [
      isA<ReviewState>().having(
        (state) => state.comment,
        'comment',
        '  Excellent  ',
      ),
      isA<ReviewState>().having(
        (state) => state.isSubmitting,
        'isSubmitting',
        true,
      ),
      isA<ReviewState>()
          .having(
            (state) => state.submissionOutcome,
            'outcome',
            ReviewPublicationOutcome.published,
          )
          .having((state) => state.reviews.single.id, 'review', 'published')
          .having((state) => state.summary.average, 'average', 5)
          .having((state) => state.comment, 'comment', ''),
    ],
  );

  blocTest<ReviewCubit, ReviewState>(
    'keeps a pending submission private while exposing its moderation state',
    build: () {
      when(
        () => repository.getByProduct(productId),
      ).thenAnswer((_) async => []);
      when(
        () => repository.create(
          productId: productId,
          rating: 4,
          comment: 'Needs moderation',
        ),
      ).thenAnswer(
        (_) async =>
            review(id: 'pending', rating: 4, status: ReviewStatus.pending),
      );
      return ReviewCubit(repository: repository, productId: productId);
    },
    act: (cubit) async {
      await cubit.load();
      cubit.setRating(4);
      cubit.setComment('Needs moderation');
      await cubit.submit();
    },
    skip: 4,
    expect: () => [
      isA<ReviewState>().having(
        (state) => state.isSubmitting,
        'isSubmitting',
        true,
      ),
      isA<ReviewState>()
          .having(
            (state) => state.submissionOutcome,
            'outcome',
            ReviewPublicationOutcome.pending,
          )
          .having((state) => state.reviews, 'public reviews', isEmpty)
          .having((state) => state.status, 'status', ReviewViewStatus.empty),
    ],
  );

  blocTest<ReviewCubit, ReviewState>(
    'exposes a retryable failure instead of converting it to empty',
    build: () {
      when(
        () => repository.getByProduct(productId),
      ).thenThrow(Exception('offline'));
      return ReviewCubit(repository: repository, productId: productId);
    },
    act: (cubit) => cubit.load(),
    expect: () => [
      isA<ReviewState>().having(
        (state) => state.status,
        'status',
        ReviewViewStatus.loading,
      ),
      isA<ReviewState>()
          .having((state) => state.status, 'status', ReviewViewStatus.failure)
          .having((state) => state.error, 'error', isNotNull),
    ],
  );
}
