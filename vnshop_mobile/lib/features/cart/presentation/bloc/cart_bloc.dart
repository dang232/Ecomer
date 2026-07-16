import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/cart_model.dart';
import '../../domain/repositories/cart_repository.dart';
import 'cart_event.dart';
import 'cart_state.dart';

class CartBloc extends Bloc<CartEvent, CartState> {
  final CartRepository _repository;

  CartBloc({required this._repository})
    : super(const CartState()) {
    on<CartStarted>(_onCartStarted);
    on<CartItemAdded>(_onCartItemAdded);
    on<CartItemRemoved>(_onCartItemRemoved);
    on<CartItemQuantityUpdated>(_onCartItemQuantityUpdated);
    on<CartItemIncremented>(_onCartItemIncremented);
    on<CartItemDecremented>(_onCartItemDecremented);
    on<CartCouponApplied>(_onCartCouponApplied);
    on<CartCouponRemoved>(_onCartCouponRemoved);
    on<CartCleared>(_onCartCleared);
    on<CartCheckoutCompleted>(_onCartCheckoutCompleted);
    on<CartFailureDismissed>(_onCartFailureDismissed);
    on<CartSyncRequested>(_onCartSyncRequested);
    on<CartConnectivityChanged>(_onConnectivityChanged);
  }

  Future<void> _onCartStarted(
    CartStarted event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(status: CartStatus.loading, clearFailure: true));

    try {
      final cart = await _repository.getCart();
      emit(
        state.copyWith(
          status: CartStatus.loaded,
          cart: cart,
          isOnline: _repository.isOnline,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(state.copyWith(status: CartStatus.error, failure: CartFailure.load));
    }
  }

  Future<void> _onCartItemAdded(
    CartItemAdded event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart ?? CartModel.empty('guest');
    final optimisticCart = currentCart.addItem(event.item);
    emit(
      state.copyWith(
        cart: optimisticCart,
        status: CartStatus.loaded,
        clearFailure: true,
      ),
    );

    try {
      final updatedCart = await _repository.addItem(event.item);
      emit(state.copyWith(cart: updatedCart, clearFailure: true));
    } catch (_) {
      // Revert on error
      emit(state.copyWith(cart: currentCart, failure: CartFailure.addItem));
    }
  }

  Future<void> _onCartItemRemoved(
    CartItemRemoved event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart;
    if (currentCart == null) return;

    final optimisticCart = currentCart.removeItem(event.cartItemId);
    emit(state.copyWith(cart: optimisticCart, clearFailure: true));

    try {
      final updatedCart = await _repository.removeItem(event.cartItemId);
      emit(state.copyWith(cart: updatedCart, clearFailure: true));
    } catch (_) {
      // Revert on error
      emit(state.copyWith(cart: currentCart, failure: CartFailure.removeItem));
    }
  }

  Future<void> _onCartItemQuantityUpdated(
    CartItemQuantityUpdated event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart;
    if (currentCart == null) return;

    final optimisticCart = currentCart.updateItemQuantity(
      event.cartItemId,
      event.quantity,
    );
    emit(state.copyWith(cart: optimisticCart, clearFailure: true));

    try {
      final updatedCart = await _repository.updateItemQuantity(
        event.cartItemId,
        event.quantity,
      );
      emit(state.copyWith(cart: updatedCart, clearFailure: true));
    } catch (_) {
      // Revert on error
      emit(
        state.copyWith(cart: currentCart, failure: CartFailure.updateQuantity),
      );
    }
  }

  Future<void> _onCartItemIncremented(
    CartItemIncremented event,
    Emitter<CartState> emit,
  ) async {
    final currentCart = state.cart;
    if (currentCart == null) return;

    final matchingItems = currentCart.items.where(
      (item) => item.cartItemId == event.cartItemId,
    );
    if (matchingItems.isEmpty) return;
    final item = matchingItems.first;

    add(
      CartItemQuantityUpdated(
        cartItemId: event.cartItemId,
        quantity: item.quantity + 1,
      ),
    );
  }

  Future<void> _onCartItemDecremented(
    CartItemDecremented event,
    Emitter<CartState> emit,
  ) async {
    final currentCart = state.cart;
    if (currentCart == null) return;

    final matchingItems = currentCart.items.where(
      (item) => item.cartItemId == event.cartItemId,
    );
    if (matchingItems.isEmpty) return;
    final item = matchingItems.first;

    if (item.quantity <= 1) {
      add(CartItemRemoved(event.cartItemId));
    } else {
      add(
        CartItemQuantityUpdated(
          cartItemId: event.cartItemId,
          quantity: item.quantity - 1,
        ),
      );
    }
  }

  Future<void> _onCartCouponApplied(
    CartCouponApplied event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(isSyncing: true, clearFailure: true));

    try {
      final updatedCart = await _repository.applyCoupon(event.couponCode);
      emit(
        state.copyWith(
          cart: updatedCart,
          isSyncing: false,
          lastAppliedCoupon: event.couponCode,
          clearFailure: true,
        ),
      );
    } catch (_) {
      emit(
        state.copyWith(isSyncing: false, failure: CartFailure.invalidCoupon),
      );
    }
  }

  Future<void> _onCartCouponRemoved(
    CartCouponRemoved event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(isSyncing: true, clearFailure: true));

    try {
      final updatedCart = await _repository.removeCoupon();
      emit(
        state.copyWith(cart: updatedCart, isSyncing: false, clearFailure: true),
      );
    } catch (_) {
      emit(state.copyWith(isSyncing: false, failure: CartFailure.removeCoupon));
    }
  }

  Future<void> _onCartCleared(
    CartCleared event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart;
    emit(
      state.copyWith(
        cart: state.cart?.clearItems(),
        isSyncing: true,
        clearFailure: true,
      ),
    );

    try {
      await _repository.clearCart();
      emit(
        state.copyWith(
          cart: state.cart?.clearItems(),
          isSyncing: false,
          clearFailure: true,
        ),
      );
    } catch (_) {
      // Revert on error
      emit(
        state.copyWith(
          cart: currentCart,
          isSyncing: false,
          failure: CartFailure.clearCart,
        ),
      );
    }
  }

  Future<void> _onCartCheckoutCompleted(
    CartCheckoutCompleted event,
    Emitter<CartState> emit,
  ) async {
    final currentCart = state.cart;
    if (currentCart == null || currentCart.isEmpty) return;

    final currentIds = currentCart.items.map((item) => item.cartItemId).toSet();
    final purchasedIds = currentIds.intersection(event.cartItemIds);
    if (purchasedIds.isEmpty) return;

    final isEntireCart = purchasedIds.length == currentCart.items.length;
    final optimisticCart = isEntireCart
        ? currentCart.clearItems()
        : currentCart.copyWith(
            items: currentCart.items
                .where((item) => !purchasedIds.contains(item.cartItemId))
                .toList(),
            clearAppliedCouponCode: true,
            discountAmount: 0,
            updatedAt: DateTime.now(),
          );

    emit(
      state.copyWith(cart: optimisticCart, isSyncing: true, clearFailure: true),
    );

    try {
      var updatedCart = optimisticCart;
      if (isEntireCart) {
        await _repository.clearCart();
      } else {
        for (final cartItemId in purchasedIds) {
          updatedCart = await _repository.removeItem(cartItemId);
        }
        if (currentCart.appliedCouponCode != null) {
          updatedCart = await _repository.removeCoupon();
        }
      }
      emit(
        state.copyWith(cart: updatedCart, isSyncing: false, clearFailure: true),
      );
    } catch (_) {
      emit(
        state.copyWith(
          cart: currentCart,
          isSyncing: false,
          failure: CartFailure.checkoutCleanup,
        ),
      );
    }
  }

  void _onCartFailureDismissed(
    CartFailureDismissed event,
    Emitter<CartState> emit,
  ) {
    emit(state.copyWith(clearFailure: true));
  }

  Future<void> _onCartSyncRequested(
    CartSyncRequested event,
    Emitter<CartState> emit,
  ) async {
    if (!state.isOnline) return;

    emit(state.copyWith(isSyncing: true, clearFailure: true));

    try {
      await _repository.syncPendingOperations();
      final cart = await _repository.getCart();
      emit(state.copyWith(cart: cart, isSyncing: false, clearFailure: true));
    } catch (_) {
      emit(state.copyWith(isSyncing: false, failure: CartFailure.sync));
    }
  }

  void _onConnectivityChanged(
    CartConnectivityChanged event,
    Emitter<CartState> emit,
  ) {
    emit(state.copyWith(isOnline: event.isOnline));

    if (event.isOnline) {
      add(const CartSyncRequested());
    }
  }
}
