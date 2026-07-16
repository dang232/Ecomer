import '../../domain/entities/review.dart';

class ReviewDto {
  const ReviewDto({
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

  factory ReviewDto.fromJson(Map<String, dynamic> json) {
    final id = _string(json['reviewId'] ?? json['id']);
    final productId = _string(json['productId'] ?? json['product_id']);
    if (id.isEmpty || productId.isEmpty) {
      throw const FormatException(
        'Review response is missing an id or productId',
      );
    }

    return ReviewDto(
      id: id,
      productId: productId,
      buyerId: _nullableString(json['buyerId'] ?? json['userId']),
      userName: _nullableString(json['userName']),
      userAvatarUrl: _nullableString(json['userAvatarUrl']),
      rating: _integer(json['rating']).clamp(1, 5),
      comment: _nullableString(json['text'] ?? json['comment']),
      images: _stringList(json['images']),
      helpfulVotes: _integer(json['helpfulVotes'] ?? json['helpful']),
      verifiedPurchase: json['verifiedPurchase'] == true,
      status: _reviewStatus(json['status']),
      createdAt: _dateTime(json['createdAt']),
    );
  }

  factory ReviewDto.fromApiResponse(dynamic response) {
    final payload = _unwrap(response);
    if (payload is! Map) {
      throw const FormatException('Review response is not an object');
    }
    return ReviewDto.fromJson(Map<String, dynamic>.from(payload));
  }

  static List<ReviewDto> listFromApiResponse(dynamic response) {
    final payload = _unwrap(response);
    final list = payload is Map ? payload['content'] : payload;
    if (list == null) return const [];
    if (list is! List) {
      throw const FormatException('Review list response is not an array');
    }
    return list
        .whereType<Map>()
        .map((item) => ReviewDto.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }

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

  Review toDomain() => Review(
    id: id,
    productId: productId,
    buyerId: buyerId,
    userName: userName,
    userAvatarUrl: userAvatarUrl,
    rating: rating,
    comment: comment,
    images: images,
    helpfulVotes: helpfulVotes,
    verifiedPurchase: verifiedPurchase,
    status: status,
    createdAt: createdAt,
  );

  static dynamic _unwrap(dynamic response) {
    var value = response;
    while (value is Map && value.containsKey('data')) {
      value = value['data'];
    }
    return value;
  }

  static String _string(dynamic value) => value?.toString().trim() ?? '';

  static String? _nullableString(dynamic value) {
    final parsed = _string(value);
    return parsed.isEmpty ? null : parsed;
  }

  static int _integer(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static List<String> _stringList(dynamic value) {
    if (value is! List) return const [];
    return value
        .map(_nullableString)
        .whereType<String>()
        .toList(growable: false);
  }

  static ReviewStatus _reviewStatus(dynamic value) =>
      switch (value?.toString().toUpperCase()) {
        'PENDING' => ReviewStatus.pending,
        'APPROVED' => ReviewStatus.approved,
        'REJECTED' => ReviewStatus.rejected,
        _ => ReviewStatus.unknown,
      };

  static DateTime? _dateTime(dynamic value) {
    if (value is DateTime) return value;
    return DateTime.tryParse(value?.toString() ?? '');
  }
}
