import 'package:equatable/equatable.dart';

import '../../data/models/cart_model.dart';

enum CartStatus {
  initial,
  loading,
  loaded,
  error,
}

class CartState extends Equatable {
  final CartStatus status;
  final CartModel? cart;
  final String? errorMessage;
  final bool isOnline;
  final bool isSyncing;
  final String? lastAppliedCoupon;

  const CartState({
    this.status = CartStatus.initial,
    this.cart,
    this.errorMessage,
    this.isOnline = true,
    this.isSyncing = false,
    this.lastAppliedCoupon,
  });

  bool get isEmpty => cart?.isEmpty ?? true;
  bool get isNotEmpty => cart?.isNotEmpty ?? false;
  int get itemCount => cart?.itemCount ?? 0;
  double get subtotal => cart?.subtotal ?? 0;
  double get discountAmount => cart?.discountAmount ?? 0;
  double get total => cart?.total ?? 0;
  String? get appliedCouponCode => cart?.appliedCouponCode;

  CartState copyWith({
    CartStatus? status,
    CartModel? cart,
    String? errorMessage,
    bool? isOnline,
    bool? isSyncing,
    String? lastAppliedCoupon,
  }) {
    return CartState(
      status: status ?? this.status,
      cart: cart ?? this.cart,
      errorMessage: errorMessage ?? this.errorMessage,
      isOnline: isOnline ?? this.isOnline,
      isSyncing: isSyncing ?? this.isSyncing,
      lastAppliedCoupon: lastAppliedCoupon ?? this.lastAppliedCoupon,
    );
  }

  @override
  List<Object?> get props => [
        status,
        cart,
        errorMessage,
        isOnline,
        isSyncing,
        lastAppliedCoupon,
      ];
}
