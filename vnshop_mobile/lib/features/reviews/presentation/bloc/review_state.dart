import 'package:equatable/equatable.dart';

import '../../domain/entities/review.dart';
import '../../domain/entities/review_summary.dart';

enum ReviewViewStatus { initial, loading, ready, empty, failure }

enum ReviewAction { published, pending, rejected, submitFailed, voteFailed }

const _unchanged = Object();

class ReviewState extends Equatable {
  const ReviewState({
    this.status = ReviewViewStatus.initial,
    this.reviews = const [],
    this.rating = 5,
    this.comment = '',
    this.isSubmitting = false,
    this.votingReviewId,
    this.submission,
    this.submissionOutcome,
    this.action,
    this.error,
  });

  final ReviewViewStatus status;
  final List<Review> reviews;
  final int rating;
  final String comment;
  final bool isSubmitting;
  final String? votingReviewId;
  final Review? submission;
  final ReviewPublicationOutcome? submissionOutcome;
  final ReviewAction? action;
  final Object? error;

  ReviewSummary get summary => ReviewSummary.fromReviews(reviews);
  bool get canSubmit =>
      rating >= 1 && rating <= 5 && comment.trim().isNotEmpty && !isSubmitting;

  ReviewState copyWith({
    ReviewViewStatus? status,
    List<Review>? reviews,
    int? rating,
    String? comment,
    bool? isSubmitting,
    Object? votingReviewId = _unchanged,
    Object? submission = _unchanged,
    Object? submissionOutcome = _unchanged,
    Object? action = _unchanged,
    Object? error = _unchanged,
  }) {
    return ReviewState(
      status: status ?? this.status,
      reviews: reviews ?? this.reviews,
      rating: rating ?? this.rating,
      comment: comment ?? this.comment,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      votingReviewId: identical(votingReviewId, _unchanged)
          ? this.votingReviewId
          : votingReviewId as String?,
      submission: identical(submission, _unchanged)
          ? this.submission
          : submission as Review?,
      submissionOutcome: identical(submissionOutcome, _unchanged)
          ? this.submissionOutcome
          : submissionOutcome as ReviewPublicationOutcome?,
      action: identical(action, _unchanged)
          ? this.action
          : action as ReviewAction?,
      error: identical(error, _unchanged) ? this.error : error,
    );
  }

  @override
  List<Object?> get props => [
    status,
    reviews,
    rating,
    comment,
    isSubmitting,
    votingReviewId,
    submission,
    submissionOutcome,
    action,
    error,
  ];
}
