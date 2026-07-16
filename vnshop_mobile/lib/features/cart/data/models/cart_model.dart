import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

import 'cart_item_model.dart';

part 'cart_model.g.dart';

@HiveType(typeId: 1)
class CartModel extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String userId;

  @HiveField(2)
  final List<CartItemModel> items;

  @HiveField(3)
  final String? appliedCouponCode;

  @HiveField(4)
  final double discountAmount;

  @HiveField(5)
  final DateTime updatedAt;

  const CartModel({
    required this.id,
    required this.userId,
    required this.items,
    this.appliedCouponCode,
    this.discountAmount = 0.0,
    required this.updatedAt,
  });

  double get subtotal => items.fold(0.0, (sum, item) => sum + item.totalPrice);

  double get total => subtotal - discountAmount;

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  bool get isEmpty => items.isEmpty;

  bool get isNotEmpty => items.isNotEmpty;

  CartModel copyWith({
    String? id,
    String? userId,
    List<CartItemModel>? items,
    String? appliedCouponCode,
    bool clearAppliedCouponCode = false,
    double? discountAmount,
    DateTime? updatedAt,
  }) {
    return CartModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      items: items ?? this.items,
      appliedCouponCode: clearAppliedCouponCode
          ? null
          : appliedCouponCode ?? this.appliedCouponCode,
      discountAmount: discountAmount ?? this.discountAmount,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  CartModel addItem(CartItemModel item) {
    final existingIndex = items.indexWhere(
      (i) => i.productId == item.productId && i.sku == item.sku,
    );

    if (existingIndex != -1) {
      final updatedItems = List<CartItemModel>.from(items);
      updatedItems[existingIndex] = updatedItems[existingIndex].copyWith(
        quantity: updatedItems[existingIndex].quantity + item.quantity,
      );
      return copyWith(items: updatedItems, updatedAt: DateTime.now());
    }

    return copyWith(items: [...items, item], updatedAt: DateTime.now());
  }

  CartModel updateItemQuantity(String cartItemId, int quantity) {
    if (quantity <= 0) {
      return removeItem(cartItemId);
    }

    final updatedItems = items.map((item) {
      if (item.cartItemId == cartItemId) {
        return item.copyWith(quantity: quantity);
      }
      return item;
    }).toList();

    return copyWith(items: updatedItems, updatedAt: DateTime.now());
  }

  CartModel removeItem(String cartItemId) {
    return copyWith(
      items: items.where((item) => item.cartItemId != cartItemId).toList(),
      updatedAt: DateTime.now(),
    );
  }

  CartModel clearItems() {
    return copyWith(
      items: [],
      clearAppliedCouponCode: true,
      discountAmount: 0.0,
      updatedAt: DateTime.now(),
    );
  }

  factory CartModel.empty(String userId) {
    return CartModel(
      id: 'local_$userId',
      userId: userId,
      items: const [],
      updatedAt: DateTime.now(),
    );
  }

  factory CartModel.fromJson(Map<String, dynamic> json) {
    return CartModel(
      id: json['id'] as String? ?? json['_id'] as String? ?? '',
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      items:
          (json['items'] as List<dynamic>?)
              ?.map((e) => CartItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      appliedCouponCode:
          json['appliedCouponCode'] as String? ??
          json['applied_coupon_code'] as String?,
      discountAmount:
          (json['discountAmount'] as num?)?.toDouble() ??
          (json['discount_amount'] as num?)?.toDouble() ??
          0.0,
      updatedAt: json['updatedAt'] != null
          ? DateTime.parse(json['updatedAt'] as String)
          : json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'userId': userId,
      'items': items.map((e) => e.toJson()).toList(),
      'appliedCouponCode': appliedCouponCode,
      'discountAmount': discountAmount,
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  @override
  List<Object?> get props => [
    id,
    userId,
    items,
    appliedCouponCode,
    discountAmount,
    updatedAt,
  ];
}
