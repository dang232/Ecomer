import 'package:equatable/equatable.dart';

enum WishlistStatus { initial, loading, ready, failure }

enum WishlistAction { added, removed, failed }

const _unchanged = Object();

class WishlistState extends Equatable {
  const WishlistState({
    this.status = WishlistStatus.initial,
    this.productIds = const [],
    this.pendingProductIds = const [],
    this.action,
    this.actionProductId,
    this.error,
  });

  final WishlistStatus status;
  final List<String> productIds;
  final List<String> pendingProductIds;
  final WishlistAction? action;
  final String? actionProductId;
  final Object? error;

  bool contains(String productId) => productIds.contains(productId);

  bool isPending(String productId) => pendingProductIds.contains(productId);

  WishlistState copyWith({
    WishlistStatus? status,
    List<String>? productIds,
    List<String>? pendingProductIds,
    Object? action = _unchanged,
    Object? actionProductId = _unchanged,
    Object? error = _unchanged,
  }) {
    return WishlistState(
      status: status ?? this.status,
      productIds: productIds ?? this.productIds,
      pendingProductIds: pendingProductIds ?? this.pendingProductIds,
      action: identical(action, _unchanged)
          ? this.action
          : action as WishlistAction?,
      actionProductId: identical(actionProductId, _unchanged)
          ? this.actionProductId
          : actionProductId as String?,
      error: identical(error, _unchanged) ? this.error : error,
    );
  }

  @override
  List<Object?> get props => [
    status,
    productIds,
    pendingProductIds,
    action,
    actionProductId,
    error,
  ];
}
