import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/entities/review.dart';
import '../../domain/repositories/review_repository.dart';
import 'review_state.dart';

class ReviewCubit extends Cubit<ReviewState> {
  ReviewCubit({required this.repository, required this.productId})
    : super(const ReviewState());

  final ReviewRepository repository;
  final String productId;

  Future<void> load() async {
    emit(
      state.copyWith(
        status: ReviewViewStatus.loading,
        action: null,
        error: null,
      ),
    );
    try {
      final reviews = await repository.getByProduct(productId);
      emit(
        state.copyWith(
          status: reviews.isEmpty
              ? ReviewViewStatus.empty
              : ReviewViewStatus.ready,
          reviews: reviews,
          error: null,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: state.reviews.isEmpty
              ? ReviewViewStatus.failure
              : ReviewViewStatus.ready,
          error: error,
        ),
      );
    }
  }

  void setRating(int rating) {
    if (rating < 1 || rating > 5 || rating == state.rating) return;
    emit(state.copyWith(rating: rating, action: null));
  }

  void setComment(String comment) {
    if (comment == state.comment) return;
    emit(state.copyWith(comment: comment, action: null));
  }

  Future<void> submit() async {
    if (!state.canSubmit) return;
    final rating = state.rating;
    final comment = state.comment.trim();
    emit(state.copyWith(isSubmitting: true, action: null, error: null));

    try {
      final review = await repository.create(
        productId: productId,
        rating: rating,
        comment: comment,
      );
      final outcome = review.publicationOutcome;
      final reviews = outcome == ReviewPublicationOutcome.published
          ? [review, ...state.reviews.where((item) => item.id != review.id)]
          : state.reviews;
      final action = switch (outcome) {
        ReviewPublicationOutcome.published => ReviewAction.published,
        ReviewPublicationOutcome.pending => ReviewAction.pending,
        ReviewPublicationOutcome.rejected => ReviewAction.rejected,
      };

      emit(
        state.copyWith(
          status: reviews.isEmpty
              ? ReviewViewStatus.empty
              : ReviewViewStatus.ready,
          reviews: reviews,
          rating: 5,
          comment: '',
          isSubmitting: false,
          submission: review,
          submissionOutcome: outcome,
          action: action,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          isSubmitting: false,
          action: ReviewAction.submitFailed,
          error: error,
        ),
      );
    }
  }

  Future<void> voteHelpful(String reviewId) async {
    if (state.votingReviewId != null) return;
    emit(state.copyWith(votingReviewId: reviewId, action: null, error: null));
    try {
      final updated = await repository.voteHelpful(reviewId);
      emit(
        state.copyWith(
          reviews: state.reviews
              .map((review) => review.id == updated.id ? updated : review)
              .toList(growable: false),
          votingReviewId: null,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          votingReviewId: null,
          action: ReviewAction.voteFailed,
          error: error,
        ),
      );
    }
  }
}
