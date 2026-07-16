import 'package:dio/dio.dart';

abstract interface class WishlistRemoteDataSource {
  Future<List<String>> getProductIds();

  Future<bool> toggle(String productId);
}

class WishlistRemoteDataSourceImpl implements WishlistRemoteDataSource {
  WishlistRemoteDataSourceImpl({required this.dio});

  final Dio dio;

  @override
  Future<List<String>> getProductIds() async {
    final response = await dio.get('/users/me/wishlist');
    final payload = _payload(response);
    final rawIds = payload['productIds'];
    if (rawIds is! List) {
      throw const FormatException('Wishlist productIds must be a list');
    }

    return rawIds
        .whereType<String>()
        .where((productId) => productId.isNotEmpty)
        .toSet()
        .toList(growable: false);
  }

  @override
  Future<bool> toggle(String productId) async {
    if (productId.isEmpty) {
      throw ArgumentError.value(productId, 'productId', 'must not be empty');
    }

    final response = await dio.post(
      '/users/me/wishlist/toggle',
      data: {'productId': productId},
    );
    final inWishlist = _payload(response)['inWishlist'];
    if (inWishlist is! bool) {
      throw const FormatException('Wishlist toggle state is missing');
    }
    return inWishlist;
  }

  Map<String, dynamic> _payload(Response<dynamic> response) {
    final envelope = response.data;
    if (envelope is! Map) {
      throw const FormatException('Wishlist response must be an object');
    }
    final payload = envelope['data'];
    if (payload is! Map) {
      throw const FormatException('Wishlist response data is missing');
    }
    return Map<String, dynamic>.from(payload);
  }
}
