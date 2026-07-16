import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/repositories/wishlist_repository.dart';
import 'wishlist_state.dart';

class WishlistCubit extends Cubit<WishlistState> {
  WishlistCubit({required this.repository}) : super(const WishlistState());

  final WishlistRepository repository;

  Future<void> load() async {
    if (state.status == WishlistStatus.loading) return;
    emit(
      state.copyWith(
        status: WishlistStatus.loading,
        action: null,
        actionProductId: null,
        error: null,
      ),
    );
    try {
      final productIds = await repository.getProductIds();
      emit(
        state.copyWith(
          status: WishlistStatus.ready,
          productIds: List.unmodifiable(productIds),
          pendingProductIds: const [],
          error: null,
        ),
      );
    } catch (error) {
      emit(state.copyWith(status: WishlistStatus.failure, error: error));
    }
  }

  Future<bool?> toggle(String productId) async {
    if (productId.isEmpty || state.isPending(productId)) return null;

    final previousIds = state.productIds;
    final optimisticInWishlist = !state.contains(productId);
    emit(
      state.copyWith(
        status: WishlistStatus.ready,
        productIds: _withMembership(
          previousIds,
          productId,
          optimisticInWishlist,
        ),
        pendingProductIds: List.unmodifiable([
          ...state.pendingProductIds,
          productId,
        ]),
        action: null,
        actionProductId: null,
        error: null,
      ),
    );

    try {
      final inWishlist = await repository.toggle(productId);
      emit(
        state.copyWith(
          productIds: _withMembership(state.productIds, productId, inWishlist),
          pendingProductIds: _without(state.pendingProductIds, productId),
          action: inWishlist ? WishlistAction.added : WishlistAction.removed,
          actionProductId: productId,
          error: null,
        ),
      );
      return inWishlist;
    } catch (error) {
      emit(
        state.copyWith(
          productIds: previousIds,
          pendingProductIds: _without(state.pendingProductIds, productId),
          action: WishlistAction.failed,
          actionProductId: productId,
          error: error,
        ),
      );
      return null;
    }
  }

  void reset() => emit(const WishlistState());

  List<String> _withMembership(
    List<String> productIds,
    String productId,
    bool contains,
  ) {
    if (contains) {
      return productIds.contains(productId)
          ? productIds
          : List.unmodifiable([...productIds, productId]);
    }
    return _without(productIds, productId);
  }

  List<String> _without(List<String> values, String value) =>
      List.unmodifiable(values.where((item) => item != value));
}
