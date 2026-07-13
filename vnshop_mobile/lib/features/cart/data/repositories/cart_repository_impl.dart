import 'dart:async';

import 'package:uuid/uuid.dart';

import '../../domain/repositories/cart_repository.dart';
import '../datasources/cart_local_datasource.dart';
import '../datasources/cart_remote_datasource.dart';
import '../models/cart_item_model.dart';
import '../models/cart_model.dart';
import '../models/pending_operation.dart';

class CartRepositoryImpl implements CartRepository {
  final CartLocalDataSource _localDataSource;
  final CartRemoteDataSource _remoteDataSource;
  final Uuid _uuid;

  // User ID will be set when auth is integrated
  String _userId = 'guest';

  bool _isOnline = true;
  StreamSubscription<void>? _connectivitySubscription;

  static const String _guestUserId = 'guest';
  static const int _maxRetryCount = 3;

  CartRepositoryImpl({
    required CartLocalDataSource localDataSource,
    required CartRemoteDataSource remoteDataSource,
    Uuid? uuid,
  })  : _localDataSource = localDataSource,
        _remoteDataSource = remoteDataSource,
        _uuid = uuid ?? const Uuid();

  void setUserId(String userId) {
    _userId = userId;
  }

  void setOnlineStatus(bool isOnline) {
    _isOnline = isOnline;
    if (isOnline) {
      syncPendingOperations();
    }
  }

  @override
  bool get isOnline => _isOnline;

  CartModel _getOrCreateLocalCart() {
    final cart = _localDataSource.getCart();
    if (cart != null) return cart;

    final newCart = CartModel.empty(_userId);
    _localDataSource.saveCart(newCart);
    return newCart;
  }

  @override
  Future<CartModel> getCart() async {
    if (_isOnline) {
      try {
        final remoteCart = await _remoteDataSource.getCart(_userId);
        final localCart = _localDataSource.getCart();

        if (localCart != null && remoteCart.isNotEmpty) {
          final merged = _mergeCarts(localCart, remoteCart);
          _localDataSource.saveCart(merged);
          return merged;
        }

        if (remoteCart.isNotEmpty) {
          _localDataSource.saveCart(remoteCart);
          return remoteCart;
        }
      } catch (e) {
        // Fallback to local cart on error
      }
    }

    return _getOrCreateLocalCart();
  }

  CartModel _mergeCarts(CartModel localCart, CartModel remoteCart) {
    final mergedItems = <String, CartItemModel>{};

    // Add remote items first
    for (final item in remoteCart.items) {
      mergedItems[item.cartItemId] = item;
    }

    // Merge local items (local takes precedence for conflicts)
    for (final localItem in localCart.items) {
      final key = '${localItem.productId}_${localItem.sku ?? ''}';
      final existingIndex = remoteCart.items.indexWhere(
        (item) => '${item.productId}_${item.sku ?? ''}' == key,
      );

      if (existingIndex == -1) {
        // Item doesn't exist in remote, add it
        final newItem = localItem.copyWith(
          cartItemId: _uuid.v4(),
        );
        mergedItems[newItem.cartItemId] = newItem;
      } else {
        // Keep the one with more quantity (assume local changes are newer intent)
        final remoteItem = remoteCart.items[existingIndex];
        if (localItem.quantity > remoteItem.quantity) {
          mergedItems[remoteItem.cartItemId] = localItem;
        }
      }
    }

    // Preserve the newer discount if available
    final discount = localCart.updatedAt.isAfter(remoteCart.updatedAt)
        ? localCart.appliedCouponCode
        : remoteCart.appliedCouponCode;
    final discountAmount = localCart.updatedAt.isAfter(remoteCart.updatedAt)
        ? localCart.discountAmount
        : remoteCart.discountAmount;

    return CartModel(
      id: remoteCart.id,
      userId: _userId,
      items: mergedItems.values.toList(),
      appliedCouponCode: discount,
      discountAmount: discountAmount,
      updatedAt: DateTime.now(),
    );
  }

  @override
  Future<CartModel> addItem(CartItemModel item) async {
    final cartItemWithId = item.copyWith(
      cartItemId: item.cartItemId.isEmpty ? _uuid.v4() : item.cartItemId,
    );

    final currentCart = _getOrCreateLocalCart();
    final updatedCart = currentCart.addItem(cartItemWithId);
    await _localDataSource.saveCart(updatedCart);

    if (_isOnline) {
      try {
        final remoteCart = await _remoteDataSource.addItem(_userId, cartItemWithId);
        await _localDataSource.saveCart(remoteCart);
        return remoteCart;
      } catch (e) {
        await _localDataSource.addPendingOperation(
          PendingOperation.addItem(
            cartItemId: cartItemWithId.cartItemId,
            productId: cartItemWithId.productId,
            name: cartItemWithId.name,
            imageUrl: cartItemWithId.imageUrl,
            price: cartItemWithId.price,
            quantity: cartItemWithId.quantity,
            sku: cartItemWithId.sku,
            optionName: cartItemWithId.optionName,
          ),
        );
      }
    } else {
      await _localDataSource.addPendingOperation(
        PendingOperation.addItem(
          cartItemId: cartItemWithId.cartItemId,
          productId: cartItemWithId.productId,
          name: cartItemWithId.name,
          imageUrl: cartItemWithId.imageUrl,
          price: cartItemWithId.price,
          quantity: cartItemWithId.quantity,
          sku: cartItemWithId.sku,
          optionName: cartItemWithId.optionName,
        ),
      );
    }

    return updatedCart;
  }

  @override
  Future<CartModel> removeItem(String cartItemId) async {
    final currentCart = _getOrCreateLocalCart();
    final updatedCart = currentCart.removeItem(cartItemId);
    await _localDataSource.saveCart(updatedCart);

    if (_isOnline) {
      try {
        await _remoteDataSource.removeItem(_userId, cartItemId);
      } catch (e) {
        await _localDataSource.addPendingOperation(
          PendingOperation.removeItem(cartItemId),
        );
      }
    } else {
      await _localDataSource.addPendingOperation(
        PendingOperation.removeItem(cartItemId),
      );
    }

    return updatedCart;
  }

  @override
  Future<CartModel> updateItemQuantity(String cartItemId, int quantity) async {
    final currentCart = _getOrCreateLocalCart();
    final updatedCart = currentCart.updateItemQuantity(cartItemId, quantity);
    await _localDataSource.saveCart(updatedCart);

    if (_isOnline) {
      try {
        final remoteCart = await _remoteDataSource.updateQuantity(
          _userId,
          cartItemId,
          quantity,
        );
        await _localDataSource.saveCart(remoteCart);
        return remoteCart;
      } catch (e) {
        await _localDataSource.addPendingOperation(
          PendingOperation.updateQuantity(
            cartItemId: cartItemId,
            quantity: quantity,
          ),
        );
      }
    } else {
      await _localDataSource.addPendingOperation(
        PendingOperation.updateQuantity(
          cartItemId: cartItemId,
          quantity: quantity,
        ),
      );
    }

    return updatedCart;
  }

  @override
  Future<CartModel> applyCoupon(String couponCode) async {
    final currentCart = _getOrCreateLocalCart();

    if (_isOnline) {
      try {
        final updatedCart = await _remoteDataSource.applyCoupon(_userId, couponCode);
        await _localDataSource.saveCart(updatedCart);
        return updatedCart;
      } catch (e) {
        // Return optimistic update
        final updatedCart = currentCart.copyWith(
          appliedCouponCode: couponCode,
          discountAmount: 0,
          updatedAt: DateTime.now(),
        );
        await _localDataSource.saveCart(updatedCart);
        await _localDataSource.addPendingOperation(
          PendingOperation.applyCoupon(couponCode),
        );
        return updatedCart;
      }
    } else {
      final updatedCart = currentCart.copyWith(
        appliedCouponCode: couponCode,
        discountAmount: 0,
        updatedAt: DateTime.now(),
      );
      await _localDataSource.saveCart(updatedCart);
      await _localDataSource.addPendingOperation(
        PendingOperation.applyCoupon(couponCode),
      );
      return updatedCart;
    }
  }

  @override
  Future<CartModel> removeCoupon() async {
    final currentCart = _getOrCreateLocalCart();
    final updatedCart = currentCart.copyWith(
      appliedCouponCode: null,
      discountAmount: 0,
      updatedAt: DateTime.now(),
    );
    await _localDataSource.saveCart(updatedCart);

    if (_isOnline) {
      try {
        await _remoteDataSource.removeCoupon(_userId);
      } catch (e) {
        await _localDataSource.addPendingOperation(
          PendingOperation.removeCoupon(),
        );
      }
    } else {
      await _localDataSource.addPendingOperation(
        PendingOperation.removeCoupon(),
      );
    }

    return updatedCart;
  }

  @override
  Future<void> clearCart() async {
    await _localDataSource.clearCart();

    if (_isOnline) {
      try {
        await _remoteDataSource.clearCart(_userId);
      } catch (e) {
        await _localDataSource.addPendingOperation(
          PendingOperation.clearCart(),
        );
      }
    } else {
      await _localDataSource.addPendingOperation(
        PendingOperation.clearCart(),
      );
    }
  }

  @override
  Future<void> syncPendingOperations() async {
    if (!_isOnline) return;

    final operations = _localDataSource.getPendingOperations();
    if (operations.isEmpty) return;

    for (final operation in operations) {
      if (operation.retryCount >= _maxRetryCount) {
        await _localDataSource.removePendingOperation(operation.id);
        continue;
      }

      try {
        await _processOperation(operation);
        await _localDataSource.removePendingOperation(operation.id);
      } catch (e) {
        await _localDataSource.addPendingOperation(
          operation.incrementRetry(),
        );
      }
    }
  }

  Future<void> _processOperation(PendingOperation operation) async {
    switch (operation.type) {
      case OperationType.addItem:
        final item = CartItemModel.fromJson(operation.payload);
        await _remoteDataSource.addItem(_userId, item);
        break;

      case OperationType.removeItem:
        final cartItemId = operation.payload['cartItemId'] as String;
        await _remoteDataSource.removeItem(_userId, cartItemId);
        break;

      case OperationType.updateQuantity:
        final cartItemId = operation.payload['cartItemId'] as String;
        final quantity = operation.payload['quantity'] as int;
        await _remoteDataSource.updateQuantity(_userId, cartItemId, quantity);
        break;

      case OperationType.applyCoupon:
        final couponCode = operation.payload['couponCode'] as String;
        await _remoteDataSource.applyCoupon(_userId, couponCode);
        break;

      case OperationType.removeCoupon:
        await _remoteDataSource.removeCoupon(_userId);
        break;

      case OperationType.clearCart:
        await _remoteDataSource.clearCart(_userId);
        break;
    }
  }

  void dispose() {
    _connectivitySubscription?.cancel();
  }
}
