import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/order_model.dart';
import '../../domain/repositories/order_repository.dart';
import '../models/order_failure.dart';

part 'order_list_event.dart';
part 'order_list_state.dart';

class OrderListBloc extends Bloc<OrderListEvent, OrderListState> {
  OrderListBloc({required this._orderRepository})
    : super(const OrderListState()) {
    on<LoadOrdersEvent>(_onLoadOrders);
    on<LoadMoreOrdersEvent>(_onLoadMoreOrders);
    on<ChangeStatusFilterEvent>(_onChangeStatusFilter);
    on<CancelOrderEvent>(_onCancelOrder);
    on<UpdateOrderFromNotificationEvent>(_onUpdateOrderFromNotification);
    on<RefreshOrdersEvent>(_onRefreshOrders);
  }

  static const int _pageSize = 20;
  final OrderRepository _orderRepository;

  Future<void> _onLoadOrders(
    LoadOrdersEvent event,
    Emitter<OrderListState> emit,
  ) async {
    emit(
      state.copyWith(
        status: OrderListStatus.loading,
        orders: const [],
        statusFilter: event.statusFilter,
        clearStatusFilter: event.statusFilter == null,
        clearFailure: true,
        currentPage: 1,
        totalElements: 0,
        hasReachedMax: false,
      ),
    );

    try {
      final result = await _orderRepository.getOrders(
        page: 1,
        limit: _pageSize,
        status: event.statusFilter,
        forceRefresh: event.forceRefresh,
      );

      emit(
        state.copyWith(
          status: OrderListStatus.loaded,
          orders: result.orders,
          currentPage: result.page,
          totalElements: result.totalElements,
          hasReachedMax: !result.hasNext,
          clearFailure: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: OrderListStatus.error,
          failure: mapOrderFailure(error),
        ),
      );
    }
  }

  Future<void> _onLoadMoreOrders(
    LoadMoreOrdersEvent event,
    Emitter<OrderListState> emit,
  ) async {
    if (state.hasReachedMax || state.status == OrderListStatus.loadingMore) {
      return;
    }

    emit(
      state.copyWith(status: OrderListStatus.loadingMore, clearFailure: true),
    );

    try {
      final result = await _orderRepository.getOrders(
        page: state.currentPage + 1,
        limit: _pageSize,
        status: state.statusFilter,
      );

      emit(
        state.copyWith(
          status: OrderListStatus.loaded,
          orders: [...state.orders, ...result.orders],
          currentPage: result.page,
          totalElements: result.totalElements,
          hasReachedMax: !result.hasNext,
          clearFailure: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: OrderListStatus.loaded,
          failure: mapOrderFailure(error),
        ),
      );
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
    emit(
      state.copyWith(
        status: OrderListStatus.cancelling,
        cancellingOrderId: event.orderId,
        clearFailure: true,
      ),
    );

    try {
      final cancelledOrder = await _orderRepository.cancelOrder(event.orderId);
      final updatedOrders = state.orders
          .map((order) => order.id == event.orderId ? cancelledOrder : order)
          .toList(growable: false);

      emit(
        state.copyWith(
          status: OrderListStatus.cancelled,
          orders: updatedOrders,
          clearCancellingOrderId: true,
          clearFailure: true,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: OrderListStatus.loaded,
          failure: mapOrderFailure(error),
          clearCancellingOrderId: true,
        ),
      );
    }
  }

  Future<void> _onUpdateOrderFromNotification(
    UpdateOrderFromNotificationEvent event,
    Emitter<OrderListState> emit,
  ) async {
    final index = state.orders.indexWhere((order) => order.id == event.orderId);
    if (index < 0) return;

    final updatedOrder = state.orders[index].copyWith(
      status: event.newStatus,
      updatedAt: DateTime.now(),
    );
    final updatedOrders = [...state.orders]..[index] = updatedOrder;

    emit(state.copyWith(orders: updatedOrders));
    await _orderRepository.cacheOrder(updatedOrder);
  }

  void _onRefreshOrders(
    RefreshOrdersEvent event,
    Emitter<OrderListState> emit,
  ) {
    add(LoadOrdersEvent(forceRefresh: true, statusFilter: state.statusFilter));
  }
}
