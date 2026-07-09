import 'package:hive_ce/hive.dart';

import '../../../../core/storage/hive_storage.dart';
import '../models/cart_model.dart';
import '../models/pending_operation.dart';

abstract class CartLocalDataSource {
  CartModel? getCart();
  Future<void> saveCart(CartModel cart);
  Future<void> clearCart();
  List<PendingOperation> getPendingOperations();
  Future<void> addPendingOperation(PendingOperation operation);
  Future<void> removePendingOperation(String id);
  Future<void> clearPendingOperations();
  bool get isOnline;
}

class CartLocalDataSourceImpl implements CartLocalDataSource {
  final Box<dynamic> _cartBox;
  final Box<dynamic> _offlineQueueBox;

  static const String _cartKey = 'current_cart';
  static const String _pendingOperationsKey = 'pending_operations';

  CartLocalDataSourceImpl({
    Box<dynamic>? cartBox,
    Box<dynamic>? offlineQueueBox,
  })  : _cartBox = cartBox ?? Hive.box<dynamic>(HiveStorage.cartBox),
        _offlineQueueBox =
            offlineQueueBox ?? Hive.box<dynamic>(HiveStorage.offlineQueueBox);

  @override
  CartModel? getCart() {
    final cartData = _cartBox.get(_cartKey);
    if (cartData == null) return null;

    if (cartData is CartModel) {
      return cartData;
    }

    if (cartData is Map) {
      try {
        return CartModel.fromJson(Map<String, dynamic>.from(cartData));
      } catch (_) {
        return null;
      }
    }

    return null;
  }

  @override
  Future<void> saveCart(CartModel cart) async {
    await _cartBox.put(_cartKey, cart);
  }

  @override
  Future<void> clearCart() async {
    await _cartBox.delete(_cartKey);
  }

  @override
  List<PendingOperation> getPendingOperations() {
    final operationsData = _offlineQueueBox.get(_pendingOperationsKey);
    if (operationsData == null) return [];

    if (operationsData is List) {
      return operationsData.whereType<PendingOperation>().toList();
    }

    return [];
  }

  @override
  Future<void> addPendingOperation(PendingOperation operation) async {
    final operations = getPendingOperations();
    final existingIndex = operations.indexWhere((op) => op.id == operation.id);

    if (existingIndex != -1) {
      operations[existingIndex] = operation;
    } else {
      operations.add(operation);
    }

    await _offlineQueueBox.put(_pendingOperationsKey, operations);
  }

  @override
  Future<void> removePendingOperation(String id) async {
    final operations = getPendingOperations();
    operations.removeWhere((op) => op.id == id);
    await _offlineQueueBox.put(_pendingOperationsKey, operations);
  }

  @override
  Future<void> clearPendingOperations() async {
    await _offlineQueueBox.delete(_pendingOperationsKey);
  }

  @override
  bool get isOnline {
    // This will be overridden by connectivity checker in repository
    return true;
  }
}
