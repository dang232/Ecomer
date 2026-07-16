part of 'order_list_bloc.dart';

enum OrderListStatus {
  initial,
  loading,
  loaded,
  loadingMore,
  error,
  cancelling,
  cancelled,
}

class OrderListState extends Equatable {
  const OrderListState({
    this.status = OrderListStatus.initial,
    this.orders = const [],
    this.statusFilter,
    this.failure,
    this.currentPage = 1,
    this.totalElements = 0,
    this.hasReachedMax = false,
    this.cancellingOrderId,
  });

  final OrderListStatus status;
  final List<OrderModel> orders;
  final OrderStatus? statusFilter;
  final OrderFailure? failure;
  final int currentPage;
  final int totalElements;
  final bool hasReachedMax;
  final String? cancellingOrderId;

  OrderListState copyWith({
    OrderListStatus? status,
    List<OrderModel>? orders,
    OrderStatus? statusFilter,
    bool clearStatusFilter = false,
    OrderFailure? failure,
    bool clearFailure = false,
    int? currentPage,
    int? totalElements,
    bool? hasReachedMax,
    String? cancellingOrderId,
    bool clearCancellingOrderId = false,
  }) {
    return OrderListState(
      status: status ?? this.status,
      orders: orders ?? this.orders,
      statusFilter: clearStatusFilter
          ? null
          : (statusFilter ?? this.statusFilter),
      failure: clearFailure ? null : (failure ?? this.failure),
      currentPage: currentPage ?? this.currentPage,
      totalElements: totalElements ?? this.totalElements,
      hasReachedMax: hasReachedMax ?? this.hasReachedMax,
      cancellingOrderId: clearCancellingOrderId
          ? null
          : (cancellingOrderId ?? this.cancellingOrderId),
    );
  }

  @override
  List<Object?> get props => [
    status,
    orders,
    statusFilter,
    failure,
    currentPage,
    totalElements,
    hasReachedMax,
    cancellingOrderId,
  ];
}
