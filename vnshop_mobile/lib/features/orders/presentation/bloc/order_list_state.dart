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
  final OrderListStatus status;
  final List<OrderModel> orders;
  final OrderStatus? statusFilter;
  final String? errorMessage;
  final int currentPage;
  final bool hasReachedMax;
  final String? cancellingOrderId;

  const OrderListState({
    this.status = OrderListStatus.initial,
    this.orders = const [],
    this.statusFilter,
    this.errorMessage,
    this.currentPage = 1,
    this.hasReachedMax = false,
    this.cancellingOrderId,
  });

  /// Lọc đơn hàng theo trạng thái
  List<OrderModel> get filteredOrders {
    if (statusFilter == null) return orders;
    return orders.where((o) => o.status == statusFilter).toList();
  }

  /// Số đơn hàng đang chờ
  int get pendingCount =>
      orders.where((o) => o.status == OrderStatus.pending).length;

  /// Số đơn hàng đã xác nhận
  int get confirmedCount =>
      orders.where((o) => o.status == OrderStatus.confirmed).length;

  /// Số đơn hàng đang giao
  int get shippedCount =>
      orders.where((o) => o.status == OrderStatus.shipped).length;

  /// Số đơn hàng hoàn thành
  int get deliveredCount =>
      orders.where((o) => o.status == OrderStatus.delivered).length;

  /// Số đơn hàng đã hủy
  int get cancelledCount =>
      orders.where((o) => o.status == OrderStatus.cancelled).length;

  OrderListState copyWith({
    OrderListStatus? status,
    List<OrderModel>? orders,
    OrderStatus? statusFilter,
    bool clearStatusFilter = false,
    String? errorMessage,
    int? currentPage,
    bool? hasReachedMax,
    String? cancellingOrderId,
    bool clearCancellingOrderId = false,
  }) {
    return OrderListState(
      status: status ?? this.status,
      orders: orders ?? this.orders,
      statusFilter: clearStatusFilter ? null : (statusFilter ?? this.statusFilter),
      errorMessage: errorMessage ?? this.errorMessage,
      currentPage: currentPage ?? this.currentPage,
      hasReachedMax: hasReachedMax ?? this.hasReachedMax,
      cancellingOrderId:
          clearCancellingOrderId ? null : (cancellingOrderId ?? this.cancellingOrderId),
    );
  }

  @override
  List<Object?> get props => [
        status,
        orders,
        statusFilter,
        errorMessage,
        currentPage,
        hasReachedMax,
        cancellingOrderId,
      ];
}
