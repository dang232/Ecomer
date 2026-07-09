import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

part 'pending_operation.g.dart';

@HiveType(typeId: 2)
enum OperationType {
  @HiveField(0)
  addItem,

  @HiveField(1)
  removeItem,

  @HiveField(2)
  updateQuantity,

  @HiveField(3)
  applyCoupon,

  @HiveField(4)
  removeCoupon,

  @HiveField(5)
  clearCart,
}

@HiveType(typeId: 3)
class PendingOperation extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final OperationType type;

  @HiveField(2)
  final Map<String, dynamic> payload;

  @HiveField(3)
  final DateTime createdAt;

  @HiveField(4)
  final int retryCount;

  @HiveField(5)
  final DateTime? lastAttemptAt;

  const PendingOperation({
    required this.id,
    required this.type,
    required this.payload,
    required this.createdAt,
    this.retryCount = 0,
    this.lastAttemptAt,
  });

  String get typeLabel {
    switch (type) {
      case OperationType.addItem:
        return 'Thêm sản phẩm';
      case OperationType.removeItem:
        return 'Xóa sản phẩm';
      case OperationType.updateQuantity:
        return 'Cập nhật số lượng';
      case OperationType.applyCoupon:
        return 'Áp dụng mã giảm giá';
      case OperationType.removeCoupon:
        return 'Xóa mã giảm giá';
      case OperationType.clearCart:
        return 'Xóa giỏ hàng';
    }
  }

  PendingOperation copyWith({
    String? id,
    OperationType? type,
    Map<String, dynamic>? payload,
    DateTime? createdAt,
    int? retryCount,
    DateTime? lastAttemptAt,
  }) {
    return PendingOperation(
      id: id ?? this.id,
      type: type ?? this.type,
      payload: payload ?? this.payload,
      createdAt: createdAt ?? this.createdAt,
      retryCount: retryCount ?? this.retryCount,
      lastAttemptAt: lastAttemptAt ?? this.lastAttemptAt,
    );
  }

  PendingOperation incrementRetry() {
    return copyWith(
      retryCount: retryCount + 1,
      lastAttemptAt: DateTime.now(),
    );
  }

  factory PendingOperation.addItem({
    required String cartItemId,
    required String productId,
    required String name,
    String? imageUrl,
    required double price,
    required int quantity,
    String? sku,
    String? optionName,
  }) {
    return PendingOperation(
      id: 'add_$cartItemId',
      type: OperationType.addItem,
      payload: {
        'cartItemId': cartItemId,
        'productId': productId,
        'name': name,
        'imageUrl': imageUrl,
        'price': price,
        'quantity': quantity,
        'sku': sku,
        'optionName': optionName,
      },
      createdAt: DateTime.now(),
    );
  }

  factory PendingOperation.removeItem(String cartItemId) {
    return PendingOperation(
      id: 'remove_$cartItemId',
      type: OperationType.removeItem,
      payload: {'cartItemId': cartItemId},
      createdAt: DateTime.now(),
    );
  }

  factory PendingOperation.updateQuantity({
    required String cartItemId,
    required int quantity,
  }) {
    return PendingOperation(
      id: 'update_$cartItemId',
      type: OperationType.updateQuantity,
      payload: {
        'cartItemId': cartItemId,
        'quantity': quantity,
      },
      createdAt: DateTime.now(),
    );
  }

  factory PendingOperation.applyCoupon(String couponCode) {
    return PendingOperation(
      id: 'coupon_$couponCode',
      type: OperationType.applyCoupon,
      payload: {'couponCode': couponCode},
      createdAt: DateTime.now(),
    );
  }

  factory PendingOperation.removeCoupon() {
    return PendingOperation(
      id: 'remove_coupon_${DateTime.now().millisecondsSinceEpoch}',
      type: OperationType.removeCoupon,
      payload: const {},
      createdAt: DateTime.now(),
    );
  }

  factory PendingOperation.clearCart() {
    return PendingOperation(
      id: 'clear_${DateTime.now().millisecondsSinceEpoch}',
      type: OperationType.clearCart,
      payload: const {},
      createdAt: DateTime.now(),
    );
  }

  @override
  List<Object?> get props => [
        id,
        type,
        payload,
        createdAt,
        retryCount,
        lastAttemptAt,
      ];
}
