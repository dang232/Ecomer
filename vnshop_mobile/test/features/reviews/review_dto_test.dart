import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/reviews/data/models/review_dto.dart';
import 'package:vnshop_mobile/features/reviews/domain/entities/review.dart';

void main() {
  group('ReviewDto', () {
    test('maps the live backend review contract from an API envelope', () {
      final reviews = ReviewDto.listFromApiResponse(const {
        'success': true,
        'data': [
          {
            'reviewId': 'review-1',
            'productId': 'product-1',
            'buyerId': 'buyer-1',
            'userName': 'Mai Nguyen',
            'userAvatarUrl': null,
            'rating': 4,
            'text': 'Âm thanh rõ ràng',
            'images': ['https://example.test/review.jpg'],
            'verifiedPurchase': true,
            'helpfulVotes': 3,
            'status': 'APPROVED',
            'createdAt': '2026-07-15T10:31:20Z',
          },
        ],
      });

      final review = reviews.single.toDomain();
      expect(review.id, 'review-1');
      expect(review.userName, 'Mai Nguyen');
      expect(review.comment, 'Âm thanh rõ ràng');
      expect(review.helpfulVotes, 3);
      expect(review.status, ReviewStatus.approved);
      expect(review.createdAt, DateTime.utc(2026, 7, 15, 10, 31, 20));
    });

    test('accepts legacy aliases and treats unknown moderation as pending', () {
      final dto = ReviewDto.fromApiResponse(const {
        'data': {
          'id': 'review-2',
          'productId': 'product-1',
          'userId': 'buyer-2',
          'comment': 'Works well',
          'helpful': 1,
          'rating': 5,
          'status': 'NEW_PROVIDER_STATE',
        },
      });

      final review = dto.toDomain();
      expect(review.status, ReviewStatus.unknown);
      expect(review.publicationOutcome, ReviewPublicationOutcome.pending);
      expect(review.comment, 'Works well');
      expect(review.helpfulVotes, 1);
    });
  });
}
