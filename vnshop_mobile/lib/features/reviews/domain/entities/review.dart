import 'package:equatable/equatable.dart';

enum ReviewStatus { pending, approved, rejected, unknown }

enum ReviewPublicationOutcome { published, pending, rejected }

class Review extends Equatable {
  const Review({
    required this.id,
    required this.productId,
    required this.rating,
    required this.helpfulVotes,
    required this.verifiedPurchase,
    required this.status,
    this.buyerId,
    this.userName,
    this.userAvatarUrl,
    this.comment,
    this.images = const [],
    this.createdAt,
  });

  final String id;
  final String productId;
  final String? buyerId;
  final String? userName;
  final String? userAvatarUrl;
  final int rating;
  final String? comment;
  final List<String> images;
  final int helpfulVotes;
  final bool verifiedPurchase;
  final ReviewStatus status;
  final DateTime? createdAt;

  ReviewPublicationOutcome get publicationOutcome => switch (status) {
    ReviewStatus.approved => ReviewPublicationOutcome.published,
    ReviewStatus.rejected => ReviewPublicationOutcome.rejected,
    ReviewStatus.pending ||
    ReviewStatus.unknown => ReviewPublicationOutcome.pending,
  };

  @override
  List<Object?> get props => [
    id,
    productId,
    buyerId,
    userName,
    userAvatarUrl,
    rating,
    comment,
    images,
    helpfulVotes,
    verifiedPurchase,
    status,
    createdAt,
  ];
}
