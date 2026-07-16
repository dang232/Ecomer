import 'package:equatable/equatable.dart';

import '../../data/models/cart_item_model.dart';

abstract class CartEvent extends Equatable {
  const CartEvent();

  @override
  List<Object?> get props => [];
}

class CartStarted extends CartEvent {
  const CartStarted();
}

class CartItemAdded extends CartEvent {
  final CartItemModel item;

  const CartItemAdded(this.item);

  @override
  List<Object?> get props => [item];
}

class CartItemRemoved extends CartEvent {
  final String cartItemId;

  const CartItemRemoved(this.cartItemId);

  @override
  List<Object?> get props => [cartItemId];
}

class CartItemQuantityUpdated extends CartEvent {
  final String cartItemId;
  final int quantity;

  const CartItemQuantityUpdated({
    required this.cartItemId,
    required this.quantity,
  });

  @override
  List<Object?> get props => [cartItemId, quantity];
}

class CartItemIncremented extends CartEvent {
  final String cartItemId;

  const CartItemIncremented(this.cartItemId);

  @override
  List<Object?> get props => [cartItemId];
}

class CartItemDecremented extends CartEvent {
  final String cartItemId;

  const CartItemDecremented(this.cartItemId);

  @override
  List<Object?> get props => [cartItemId];
}

class CartCouponApplied extends CartEvent {
  final String couponCode;

  const CartCouponApplied(this.couponCode);

  @override
  List<Object?> get props => [couponCode];
}

class CartCouponRemoved extends CartEvent {
  const CartCouponRemoved();
}

class CartCleared extends CartEvent {
  const CartCleared();
}

class CartCheckoutCompleted extends CartEvent {
  final Set<String> cartItemIds;

  const CartCheckoutCompleted(this.cartItemIds);

  @override
  List<Object?> get props => [cartItemIds];
}

class CartFailureDismissed extends CartEvent {
  const CartFailureDismissed();
}

class CartSyncRequested extends CartEvent {
  const CartSyncRequested();
}

class CartConnectivityChanged extends CartEvent {
  final bool isOnline;

  const CartConnectivityChanged(this.isOnline);

  @override
  List<Object?> get props => [isOnline];
}
