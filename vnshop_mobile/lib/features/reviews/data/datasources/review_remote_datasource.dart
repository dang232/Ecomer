import 'package:dio/dio.dart';

import '../../../../core/constants/api_constants.dart';
import '../models/review_dto.dart';

abstract class ReviewRemoteDataSource {
  Future<List<ReviewDto>> getByProduct(String productId);

  Future<ReviewDto> create({
    required String productId,
    required int rating,
    required String comment,
  });

  Future<ReviewDto> voteHelpful(String reviewId);
}

class ReviewRemoteDataSourceImpl implements ReviewRemoteDataSource {
  const ReviewRemoteDataSourceImpl({required this.dio});

  final Dio dio;

  @override
  Future<List<ReviewDto>> getByProduct(String productId) async {
    final response = await dio.get<dynamic>(
      '${ApiConstants.reviews}/product/${Uri.encodeComponent(productId)}',
    );
    return ReviewDto.listFromApiResponse(response.data);
  }

  @override
  Future<ReviewDto> create({
    required String productId,
    required int rating,
    required String comment,
  }) async {
    final response = await dio.post<dynamic>(
      ApiConstants.reviews,
      data: {'productId': productId, 'rating': rating, 'comment': comment},
    );
    return ReviewDto.fromApiResponse(response.data);
  }

  @override
  Future<ReviewDto> voteHelpful(String reviewId) async {
    final response = await dio.put<dynamic>(
      '${ApiConstants.reviews}/${Uri.encodeComponent(reviewId)}/helpful',
    );
    return ReviewDto.fromApiResponse(response.data);
  }
}
