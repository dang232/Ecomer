import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../products/data/models/product_model.dart';
import '../../../products/domain/repositories/product_repository.dart';
import 'favorites_state.dart';
import 'wishlist_cubit.dart';
import 'wishlist_state.dart';

class FavoritesCubit extends Cubit<FavoritesState> {
  FavoritesCubit({required this.productRepository, required this.wishlistCubit})
    : super(const FavoritesState()) {
    _wishlistSubscription = wishlistCubit.stream.listen(_onWishlistChanged);
    unawaited(_synchronize(wishlistCubit.state));
  }

  final ProductRepository productRepository;
  final WishlistCubit wishlistCubit;
  late final StreamSubscription<WishlistState> _wishlistSubscription;
  int _requestVersion = 0;

  Future<void> refresh() => wishlistCubit.load();

  Future<void> retryProducts() =>
      _synchronize(wishlistCubit.state, forceReload: true);

  void _onWishlistChanged(WishlistState wishlistState) {
    unawaited(_synchronize(wishlistState));
  }

  Future<void> _synchronize(
    WishlistState wishlistState, {
    bool forceReload = false,
  }) async {
    switch (wishlistState.status) {
      case WishlistStatus.initial:
        return;
      case WishlistStatus.loading:
        _requestVersion++;
        emit(
          state.copyWith(
            status: FavoritesStatus.loading,
            failedProductIds: const [],
            error: null,
          ),
        );
        return;
      case WishlistStatus.failure:
        _requestVersion++;
        emit(
          state.copyWith(
            status: FavoritesStatus.failure,
            failedProductIds: const [],
            error: wishlistState.error,
          ),
        );
        return;
      case WishlistStatus.ready:
        await _hydrateProducts(
          _uniqueProductIds(wishlistState.productIds),
          forceReload: forceReload,
        );
    }
  }

  Future<void> _hydrateProducts(
    List<String> productIds, {
    required bool forceReload,
  }) async {
    final requestVersion = ++_requestVersion;

    if (productIds.isEmpty) {
      emit(const FavoritesState(status: FavoritesStatus.success, products: []));
      return;
    }

    final knownProducts = {
      for (final product in state.products) product.id: product,
    };
    final missingIds = forceReload
        ? productIds
        : productIds.where((id) => !knownProducts.containsKey(id)).toList();

    if (missingIds.isEmpty) {
      emit(
        FavoritesState(
          status: FavoritesStatus.success,
          products: List.unmodifiable(
            productIds.map((id) => knownProducts[id]!),
          ),
        ),
      );
      return;
    }

    final retainedProducts = productIds
        .where(knownProducts.containsKey)
        .map((id) => knownProducts[id]!)
        .toList();
    emit(
      FavoritesState(
        status: FavoritesStatus.loading,
        products: List.unmodifiable(retainedProducts),
      ),
    );

    final results = await Future.wait(missingIds.map(_loadProduct));
    if (isClosed || requestVersion != _requestVersion) return;

    final loadedProducts = Map<String, ProductModel>.from(knownProducts);
    final failedIds = <String>[];
    Object? firstError;

    for (final result in results) {
      final product = result.product;
      if (product != null) {
        loadedProducts[result.productId] = product;
      } else {
        failedIds.add(result.productId);
        firstError ??= result.error;
      }
    }

    final orderedProducts = productIds
        .map((id) => loadedProducts[id])
        .whereType<ProductModel>()
        .toList(growable: false);
    emit(
      FavoritesState(
        status: orderedProducts.isEmpty && failedIds.isNotEmpty
            ? FavoritesStatus.failure
            : FavoritesStatus.success,
        products: List.unmodifiable(orderedProducts),
        failedProductIds: List.unmodifiable(failedIds),
        error: firstError,
      ),
    );
  }

  Future<_ProductLoadResult> _loadProduct(String productId) async {
    try {
      return _ProductLoadResult(
        productId: productId,
        product: await productRepository.getProductById(productId),
      );
    } catch (error) {
      return _ProductLoadResult(productId: productId, error: error);
    }
  }

  List<String> _uniqueProductIds(List<String> productIds) => [
    ...{
      for (final productId in productIds)
        if (productId.isNotEmpty) productId,
    },
  ];

  @override
  Future<void> close() async {
    await _wishlistSubscription.cancel();
    return super.close();
  }
}

class _ProductLoadResult {
  const _ProductLoadResult({required this.productId, this.product, this.error});

  final String productId;
  final ProductModel? product;
  final Object? error;
}
