import 'package:dio/dio.dart';

import '../models/cart_item_model.dart';
import '../models/cart_model.dart';

abstract class CartRemoteDataSource {
  Future<CartModel> getCart(String userId);
  Future<CartModel> addItem(String userId, CartItemModel item);
  Future<void> removeItem(String userId, String cartItemId);
  Future<CartModel> updateQuantity(
    String userId,
    String cartItemId,
    int quantity,
  );
  Future<CartModel> applyCoupon(String userId, String couponCode);
  Future<CartModel> removeCoupon(String userId);
  Future<void> clearCart(String userId);
  Future<CartModel> syncCart(String userId, CartModel localCart);
}

class CartRemoteDataSourceImpl implements CartRemoteDataSource {
  final Dio _dio;

  static const bool _useMockBackend = bool.fromEnvironment(
    'USE_MOCK_BACKEND',
    defaultValue: false,
  );

  CartRemoteDataSourceImpl({required this._dio});

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
    );

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;
    return CartModel.fromJson(data);
  }

  @override
  Future<CartModel> addItem(String userId, CartItemModel item) async {
    if (_useMockBackend) {
      return _mockAddItem(userId, item);
    }

    // P1: backend derives user from JWT — do not echo userId in the body.
    // `userId` parameter kept for the abstract contract and mock path.
    final response = await _dio.post(
      '/cart/items',
      options: Options(headers: _headers),
      data: {
        'productId': item.productId,
        if (item.sku != null) 'variantId': item.sku,
        'quantity': item.quantity,
      },
    );

    return _cartFromResponse(response);
  }

  @override
  Future<void> removeItem(String userId, String cartItemId) async {
    if (_useMockBackend) {
      return _mockRemoveItem(userId, cartItemId);
    }

    final itemKey = _itemKeyParts(cartItemId);
    await _dio.delete(
      '/cart/items/${itemKey.productId}',
      options: Options(headers: _headers),
      data: {if (itemKey.variantId != null) 'variantId': itemKey.variantId},
    );
  }

  @override
  Future<CartModel> updateQuantity(
    String userId,
    String cartItemId,
    int quantity,
  ) async {
    if (_useMockBackend) {
      return _mockUpdateQuantity(userId, cartItemId, quantity);
    }

    // P1: backend derives user from JWT — do not echo userId in the body.
    final itemKey = _itemKeyParts(cartItemId);
    final response = await _dio.put(
      '/cart/items/${itemKey.productId}',
      options: Options(headers: _headers),
      data: {
        'quantity': quantity,
        if (itemKey.variantId != null) 'variantId': itemKey.variantId,
      },
    );

    return _cartFromResponse(response);
  }

  @override
  Future<CartModel> applyCoupon(String userId, String couponCode) async {
    if (_useMockBackend) {
      return _mockApplyCoupon(userId, couponCode);
    }

    // P1: backend derives user from JWT — do not echo userId in the body.
    final response = await _dio.post(
      '/cart/coupon',
      options: Options(headers: _headers),
      data: {'couponCode': couponCode},
    );

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;
    return CartModel.fromJson(data);
  }

  @override
  Future<CartModel> removeCoupon(String userId) async {
    if (_useMockBackend) {
      return _mockRemoveCoupon(userId);
    }

    final response = await _dio.delete(
      '/cart/coupon',
      options: Options(headers: _headers),
    );

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;
    return CartModel.fromJson(data);
  }

  @override
  Future<void> clearCart(String userId) async {
    if (_useMockBackend) {
      return _mockClearCart(userId);
    }

    await _dio.delete('/cart', options: Options(headers: _headers));
  }

  @override
  Future<CartModel> syncCart(String userId, CartModel localCart) async {
    if (_useMockBackend) {
      return _mockSyncCart(userId, localCart);
    }

    // P1: backend derives user from JWT — do not echo userId in the body.
    final response = await _dio.post(
      '/cart/sync',
      options: Options(headers: _headers),
      data: localCart.toJson(),
    );

    final responseData = response.data as Map<String, dynamic>;
    final data = responseData['data'] as Map<String, dynamic>;
    return CartModel.fromJson(data);
  }

  // Mock implementations for testing
  Future<CartModel> _mockGetCart(String userId) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return CartModel.empty(userId);
  }

  Future<CartModel> _mockAddItem(String userId, CartItemModel item) async {
    await Future.delayed(const Duration(milliseconds: 200));
    return CartModel.empty(userId).addItem(item);
  }

  Future<void> _mockRemoveItem(String userId, String cartItemId) async {
    await Future.delayed(const Duration(milliseconds: 200));
  }

  Future<CartModel> _mockUpdateQuantity(
    String userId,
    String cartItemId,
    int quantity,
  ) async {
    await Future.delayed(const Duration(milliseconds: 200));
    final itemKey = _itemKeyParts(cartItemId);
    return CartModel.empty(userId).addItem(
      CartItemModel(
        cartItemId: cartItemId,
        productId: itemKey.productId,
        name: '',
        price: 0,
        quantity: quantity,
        sku: itemKey.variantId,
      ),
    );
  }

  Future<CartModel> _mockApplyCoupon(String userId, String couponCode) async {
    await Future.delayed(const Duration(milliseconds: 300));
    return CartModel.empty(
      userId,
    ).copyWith(appliedCouponCode: couponCode, discountAmount: 10000);
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

  CartModel _cartFromResponse(Response<dynamic> response) {
    final responseData = response.data as Map<String, dynamic>;
    return CartModel.fromJson(responseData['data'] as Map<String, dynamic>);
  }

  ({String productId, String? variantId}) _itemKeyParts(String itemKey) {
    final separator = itemKey.indexOf(':');
    if (separator < 0) {
      return (productId: itemKey, variantId: null);
    }
    return (
      productId: itemKey.substring(0, separator),
      variantId: itemKey.substring(separator + 1),
    );
  }
}
