import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/order_model.dart';
import '../../domain/repositories/order_repository.dart';

part 'order_list_event.dart';
part 'order_list_state.dart';

class OrderListBloc extends Bloc<OrderListEvent, OrderListState> {
  final OrderRepository _orderRepository;
  static const int _pageSize = 20;

  OrderListBloc({required OrderRepository orderRepository})
      : _orderRepository = orderRepository,
        super(const OrderListState()) {
    on<LoadOrdersEvent>(_onLoadOrders);
    on<LoadMoreOrdersEvent>(_onLoadMoreOrders);
    on<ChangeStatusFilterEvent>(_onChangeStatusFilter);
    on<CancelOrderEvent>(_onCancelOrder);
    on<UpdateOrderFromNotificationEvent>(_onUpdateOrderFromNotification);
    on<RefreshOrdersEvent>(_onRefreshOrders);
  }

  Future<void> _onLoadOrders(
    LoadOrdersEvent event,
    Emitter<OrderListState> emit,
  ) async {
    emit(state.copyWith(
      status: OrderListStatus.loading,
      statusFilter: event.statusFilter,
      clearStatusFilter: event.statusFilter == null,
    ));

    try {
      final orders = await _orderRepository.getOrders(
        page: 1,
        limit: _pageSize,
        status: event.statusFilter,
        forceRefresh: event.forceRefresh,
      );

      emit(state.copyWith(
        status: OrderListStatus.loaded,
        orders: orders,
        currentPage: 1,
        hasReachedMax: orders.length < _pageSize,
      ));
    } on DioException catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: _getErrorMessage(e),
      ));
    } catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: 'Đã xảy ra lỗi không xác định',
      ));
    }
  }

  Future<void> _onLoadMoreOrders(
    LoadMoreOrdersEvent event,
    Emitter<OrderListState> emit,
  ) async {
    if (state.hasReachedMax || state.status == OrderListStatus.loadingMore) {
      return;
    }

    emit(state.copyWith(status: OrderListStatus.loadingMore));

    try {
      final nextPage = state.currentPage + 1;
      final orders = await _orderRepository.getOrders(
        page: nextPage,
        limit: _pageSize,
        status: state.statusFilter,
      );

      emit(state.copyWith(
        status: OrderListStatus.loaded,
        orders: [...state.orders, ...orders],
        currentPage: nextPage,
        hasReachedMax: orders.length < _pageSize,
      ));
    } on DioException catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: _getErrorMessage(e),
      ));
    } catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: 'Không thể tải thêm đơn hàng',
      ));
    }
  }

  void _onChangeStatusFilter(
    ChangeStatusFilterEvent event,
    Emitter<OrderListState> emit,
  ) {
    add(LoadOrdersEvent(statusFilter: event.status));
  }

  Future<void> _onCancelOrder(
    CancelOrderEvent event,
    Emitter<OrderListState> emit,
  ) async {
    emit(state.copyWith(
      status: OrderListStatus.cancelling,
      cancellingOrderId: event.orderId,
    ));

    try {
      final cancelledOrder = await _orderRepository.cancelOrder(event.orderId);

      final updatedOrders = state.orders.map((order) {
        if (order.id == event.orderId) {
          return cancelledOrder;
        }
        return order;
      }).toList();

      emit(state.copyWith(
        status: OrderListStatus.cancelled,
        orders: updatedOrders,
        clearCancellingOrderId: true,
      ));
    } on DioException catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: _getErrorMessage(e),
        clearCancellingOrderId: true,
      ));
    } catch (e) {
      emit(state.copyWith(
        status: OrderListStatus.error,
        errorMessage: 'Không thể hủy đơn hàng',
        clearCancellingOrderId: true,
      ));
    }
  }

  void _onUpdateOrderFromNotification(
    UpdateOrderFromNotificationEvent event,
    Emitter<OrderListState> emit,
  ) {
    final updatedOrders = state.orders.map((order) {
      if (order.id == event.orderId) {
        return order.copyWith(
          status: event.newStatus,
          updatedAt: DateTime.now(),
        );
      }
      return order;
    }).toList();

    emit(state.copyWith(orders: updatedOrders));

    // Cập nhật cache
    _orderRepository.cacheOrder(
      state.orders.firstWhere((o) => o.id == event.orderId),
    );
  }

  Future<void> _onRefreshOrders(
    RefreshOrdersEvent event,
    Emitter<OrderListState> emit,
  ) async {
    add(LoadOrdersEvent(forceRefresh: true, statusFilter: state.statusFilter));
  }

  String _getErrorMessage(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return 'Kết nối mạng chậm. Vui lòng thử lại.';
      case DioExceptionType.connectionError:
        return 'Không có kết nối mạng. Vui lòng kiểm tra internet.';
      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode;
        if (statusCode == 401) {
          return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
        } else if (statusCode == 403) {
          return 'Bạn không có quyền thực hiện thao tác này.';
        } else if (statusCode == 404) {
          return 'Không tìm thấy đơn hàng.';
        } else if (statusCode == 500) {
          return 'Máy chủ đang bận. Vui lòng thử lại sau.';
        }
        return e.message ?? 'Đã xảy ra lỗi từ máy chủ.';
      case DioExceptionType.cancel:
        return 'Yêu cầu bị hủy.';
      default:
        return 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
  }
}
