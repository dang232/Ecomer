part of 'order_list_bloc.dart';

abstract class OrderListEvent extends Equatable {
  const OrderListEvent();

  @override
  List<Object?> get props => [];
}

/// Tải danh sách đơn hàng
class LoadOrdersEvent extends OrderListEvent {
  final bool forceRefresh;
  final OrderStatus? statusFilter;

  const LoadOrdersEvent({
    this.forceRefresh = false,
    this.statusFilter,
  });

  @override
  List<Object?> get props => [forceRefresh, statusFilter];
}

/// Tải thêm đơn hàng (phân trang)
class LoadMoreOrdersEvent extends OrderListEvent {
  const LoadMoreOrdersEvent();
}

/// Thay đổi bộ lọc trạng thái
class ChangeStatusFilterEvent extends OrderListEvent {
  final OrderStatus? status;

  const ChangeStatusFilterEvent(this.status);

  @override
  List<Object?> get props => [status];
}

/// Hủy đơn hàng
class CancelOrderEvent extends OrderListEvent {
  final String orderId;

  const CancelOrderEvent(this.orderId);

  @override
  List<Object?> get props => [orderId];
}

/// Cập nhật đơn hàng từ notification
class UpdateOrderFromNotificationEvent extends OrderListEvent {
  final String orderId;
  final OrderStatus newStatus;

  const UpdateOrderFromNotificationEvent({
    required this.orderId,
    required this.newStatus,
  });

  @override
  List<Object?> get props => [orderId, newStatus];
}

/// Làm mới danh sách đơn hàng
class RefreshOrdersEvent extends OrderListEvent {
  const RefreshOrdersEvent();
}
