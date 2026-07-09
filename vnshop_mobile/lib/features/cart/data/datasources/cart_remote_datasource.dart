import 'package:dio/dio.dart';

import '../models/cart_item_model.dart';
import '../models/cart_model.dart';

abstract class CartRemoteDataSource {
  Future<CartModel> getCart(String userId);
  Future<CartItemModel> addItem(String userId, CartItemModel item);
  Future<void> removeItem(String userId, String cartItemId);
  Future<CartItemModel> updateQuantity(String userId, String cartItemId, int quantity);
  Future<CartModel> applyCoupon(String userId, String couponCode);
  Future<CartModel> removeCoupon(String userId);
  Future<void> clearCart(String userId);
  Future<CartModel> syncCart(String userId, CartModel localCart);
}

class CartRemoteDataSourceImpl implements CartRemoteDataSource {
  final Dio _dio;
  final String _baseUrl;

  static const bool _useMockBackend =
      bool.fromEnvironment('USE_MOCK_BACKEND', defaultValue: false);

  CartRemoteDataSourceImpl({
    required Dio dio,
    String? baseUrl,
  })  : _dio = dio,
        _baseUrl = baseUrl ?? 'https://api.vnshop.example.com';

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

  @override
  Future<CartModel> getCart(String userId) async {
    if (_useMockBackend) {
      return _mockGetCart(userId);
    }

    final response = await _dio.get(
      '/cart',
      options: Options(headers: _headers),
      queryParameters: {'userId': userId},
    );

    return CartModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<CartItemModel> addItem(String userId, CartItemModel item) async {
    if (_useMockBackend) {
      return _mockAddItem(userId, item);
    }

    final response = await _dio.post(
      '/cart/items',
      options: Options(headers: _headers),
      data: {
        'userId': userId,
        'item': item.toJson(),
      },
    );

    return CartItemModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> removeItem(String userId, String cartItemId) async {
    if (_useMockBackend) {
      return _mockRemoveItem(userId, cartItemId);
    }

    await _dio.delete(
      '/cart/items/$cartItemId',
      options: Options(headers: _headers),
      queryParameters: {'userId': userId},
    );
  }

  @override
  Future<CartItemModel> updateQuantity(
    String userId,
    String cartItemId,
    int quantity,
  ) async {
    if (_useMockBackend) {
      return _mockUpdateQuantity(userId, cartItemId, quantity);
    }

    final response = await _dio.patch(
      '/cart/items/$cartItemId',
      options: Options(headers: _headers),
      data: {
        'userId': userId,
        'quantity': quantity,
      },
    );

    return CartItemModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<CartModel> applyCoupon(String userId, String couponCode) async {
    if (_useMockBackend) {
      return _mockApplyCoupon(userId, couponCode);
    }

    final response = await _dio.post(
      '/cart/coupon',
      options: Options(headers: _headers),
      data: {
        'userId': userId,
        'couponCode': couponCode,
      },
    );

    return CartModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<CartModel> removeCoupon(String userId) async {
    if (_useMockBackend) {
      return _mockRemoveCoupon(userId);
    }

    final response = await _dio.delete(
      '/cart/coupon',
      options: Options(headers: _headers),
      queryParameters: {'userId': userId},
    );

    return CartModel.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> clearCart(String userId) async {
    if (_useMockBackend) {
      return _mockClearCart(userId);
    }

    await _dio.delete(
      '/cart',
      options: Options(headers: _headers),
      queryParameters: {'userId': userId},
    );
  }

  @override
  Future<CartModel> syncCart(String userId, CartModel localCart) async {
    if (_useMockBackend) {
      return _mockSyncCart(userId, localCart);
    }

    final response = await _dio.post(
      '/cart/sync',
      options: Options(headers: _headers),
      data: {
        'userId': userId,
        'localCart': localCart.toJson(),
      },
    );

    return CartModel.fromJson(response.data as Map<String, dynamic>);
  }

  // Mock implementations for testing
  Future<CartModel> _mockGetCart(String userId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return CartModel.empty(userId);
  }

  Future<CartItemModel> _mockAddItem(String userId, CartItemModel item) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return item;
  }

  Future<void> _mockRemoveItem(String userId, String cartItemId) async {
    await Future.delayed(const Duration(milliseconds: 200));
  }

  Future<CartItemModel> _mockUpdateQuantity(
    String userId,
    String cartItemId,
    int quantity,
  ) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return CartItemModel(
      cartItemId: cartItemId,
      productId: '',
      name: '',
      price: 0,
      quantity: quantity,
    );
  }

  Future<CartModel> _mockApplyCoupon(String userId, String couponCode) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return CartModel.empty(userId).copyWith(
      appliedCouponCode: couponCode,
      discountAmount: 10000,
    );
  }

  Future<CartModel> _mockRemoveCoupon(String userId) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return CartModel.empty(userId);
  }

  Future<void> _mockClearCart(String userId) async {
    await Future.delayed(const Duration(milliseconds: 200));
  }

  Future<CartModel> _mockSyncCart(String userId, CartModel localCart) async {
    await Future.delayed(const Duration(milliseconds: 400));
    return localCart;
  }
}
