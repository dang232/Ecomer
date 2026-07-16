import 'package:equatable/equatable.dart';

import '../../../products/data/models/product_model.dart';

enum FavoritesStatus { initial, loading, success, failure }

const _unchanged = Object();

class FavoritesState extends Equatable {
  const FavoritesState({
    this.status = FavoritesStatus.initial,
    this.products = const [],
    this.failedProductIds = const [],
    this.error,
  });

  final FavoritesStatus status;
  final List<ProductModel> products;
  final List<String> failedProductIds;
  final Object? error;

  bool get isEmpty => status == FavoritesStatus.success && products.isEmpty;

  bool get isRefreshing =>
      status == FavoritesStatus.loading && products.isNotEmpty;

  bool get hasPartialFailure =>
      products.isNotEmpty && failedProductIds.isNotEmpty;

  FavoritesState copyWith({
    FavoritesStatus? status,
    List<ProductModel>? products,
    List<String>? failedProductIds,
    Object? error = _unchanged,
  }) {
    return FavoritesState(
      status: status ?? this.status,
      products: products ?? this.products,
      failedProductIds: failedProductIds ?? this.failedProductIds,
      error: identical(error, _unchanged) ? this.error : error,
    );
  }

  @override
  List<Object?> get props => [status, products, failedProductIds, error];
}
