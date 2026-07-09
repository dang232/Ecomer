import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/cart_model.dart';
import '../../domain/repositories/cart_repository.dart';
import 'cart_event.dart';
import 'cart_state.dart';

class CartBloc extends Bloc<CartEvent, CartState> {
  final CartRepository _repository;

  CartBloc({required CartRepository repository})
      : _repository = repository,
        super(const CartState()) {
    on<CartStarted>(_onCartStarted);
    on<CartItemAdded>(_onCartItemAdded);
    on<CartItemRemoved>(_onCartItemRemoved);
    on<CartItemQuantityUpdated>(_onCartItemQuantityUpdated);
    on<CartItemIncremented>(_onCartItemIncremented);
    on<CartItemDecremented>(_onCartItemDecremented);
    on<CartCouponApplied>(_onCartCouponApplied);
    on<CartCouponRemoved>(_onCartCouponRemoved);
    on<CartCleared>(_onCartCleared);
    on<CartSyncRequested>(_onCartSyncRequested);
    on<CartConnectivityChanged>(_onConnectivityChanged);
  }

  Future<void> _onCartStarted(
    CartStarted event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(status: CartStatus.loading));

    try {
      final cart = await _repository.getCart();
      emit(state.copyWith(
        status: CartStatus.loaded,
        cart: cart,
        isOnline: _repository.isOnline,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: CartStatus.error,
        errorMessage: 'Không thể tải giỏ hàng: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCartItemAdded(
    CartItemAdded event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart ?? CartModel.empty('guest');
    final optimisticCart = currentCart.addItem(event.item);
    emit(state.copyWith(cart: optimisticCart, status: CartStatus.loaded));

    try {
      final updatedCart = await _repository.addItem(event.item);
      emit(state.copyWith(cart: updatedCart));
    } catch (e) {
      // Revert on error
      emit(state.copyWith(
        cart: currentCart,
        errorMessage: 'Không thể thêm sản phẩm: ${e.toString()}',
      ));
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
    emit(state.copyWith(cart: optimisticCart));

    try {
      final updatedCart = await _repository.removeItem(event.cartItemId);
      emit(state.copyWith(cart: updatedCart));
    } catch (e) {
      // Revert on error
      emit(state.copyWith(
        cart: currentCart,
        errorMessage: 'Không thể xóa sản phẩm: ${e.toString()}',
      ));
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
    emit(state.copyWith(cart: optimisticCart));

    try {
      final updatedCart = await _repository.updateItemQuantity(
        event.cartItemId,
        event.quantity,
      );
      emit(state.copyWith(cart: updatedCart));
    } catch (e) {
      // Revert on error
      emit(state.copyWith(
        cart: currentCart,
        errorMessage: 'Không thể cập nhật số lượng: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCartItemIncremented(
    CartItemIncremented event,
    Emitter<CartState> emit,
  ) async {
    final currentCart = state.cart;
    if (currentCart == null) return;

    final item = currentCart.items.firstWhere(
      (i) => i.cartItemId == event.cartItemId,
      orElse: () => throw Exception('Item not found'),
    );

    add(CartItemQuantityUpdated(
      cartItemId: event.cartItemId,
      quantity: item.quantity + 1,
    ));
  }

  Future<void> _onCartItemDecremented(
    CartItemDecremented event,
    Emitter<CartState> emit,
  ) async {
    final currentCart = state.cart;
    if (currentCart == null) return;

    final item = currentCart.items.firstWhere(
      (i) => i.cartItemId == event.cartItemId,
      orElse: () => throw Exception('Item not found'),
    );

    if (item.quantity <= 1) {
      add(CartItemRemoved(event.cartItemId));
    } else {
      add(CartItemQuantityUpdated(
        cartItemId: event.cartItemId,
        quantity: item.quantity - 1,
      ));
    }
  }

  Future<void> _onCartCouponApplied(
    CartCouponApplied event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(isSyncing: true));

    try {
      final updatedCart = await _repository.applyCoupon(event.couponCode);
      emit(state.copyWith(
        cart: updatedCart,
        isSyncing: false,
        lastAppliedCoupon: event.couponCode,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSyncing: false,
        errorMessage: 'Mã giảm giá không hợp lệ: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCartCouponRemoved(
    CartCouponRemoved event,
    Emitter<CartState> emit,
  ) async {
    emit(state.copyWith(isSyncing: true));

    try {
      final updatedCart = await _repository.removeCoupon();
      emit(state.copyWith(
        cart: updatedCart,
        isSyncing: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSyncing: false,
        errorMessage: 'Không thể xóa mã giảm giá: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCartCleared(
    CartCleared event,
    Emitter<CartState> emit,
  ) async {
    // Optimistic update
    final currentCart = state.cart;
    emit(state.copyWith(
      cart: state.cart?.clearItems(),
      isSyncing: true,
    ));

    try {
      await _repository.clearCart();
      emit(state.copyWith(
        cart: state.cart?.clearItems(),
        isSyncing: false,
      ));
    } catch (e) {
      // Revert on error
      emit(state.copyWith(
        cart: currentCart,
        isSyncing: false,
        errorMessage: 'Không thể xóa giỏ hàng: ${e.toString()}',
      ));
    }
  }

  Future<void> _onCartSyncRequested(
    CartSyncRequested event,
    Emitter<CartState> emit,
  ) async {
    if (!state.isOnline) return;

    emit(state.copyWith(isSyncing: true));

    try {
      await _repository.syncPendingOperations();
      final cart = await _repository.getCart();
      emit(state.copyWith(
        cart: cart,
        isSyncing: false,
      ));
    } catch (e) {
      emit(state.copyWith(
        isSyncing: false,
        errorMessage: 'Không thể đồng bộ giỏ hàng: ${e.toString()}',
      ));
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
