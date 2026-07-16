import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../data/models/order_model.dart';
import '../../domain/repositories/order_repository.dart';
import '../models/order_failure.dart';

enum OrderDetailStatus {
  initial,
  loading,
  loaded,
  cancelling,
  cancelled,
  error,
}

class OrderDetailState extends Equatable {
  const OrderDetailState({
    this.status = OrderDetailStatus.initial,
    this.order,
    this.failure,
  });

  final OrderDetailStatus status;
  final OrderModel? order;
  final OrderFailure? failure;

  OrderDetailState copyWith({
    OrderDetailStatus? status,
    OrderModel? order,
    OrderFailure? failure,
    bool clearFailure = false,
  }) {
    return OrderDetailState(
      status: status ?? this.status,
      order: order ?? this.order,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }

  @override
  List<Object?> get props => [status, order, failure];
}

class OrderDetailCubit extends Cubit<OrderDetailState> {
  OrderDetailCubit({
    required this._orderId,
    required this._repository,
  }) : super(const OrderDetailState());

  final String _orderId;
  final OrderRepository _repository;

  Future<void> load() async {
    if (_orderId.trim().isEmpty) {
      emit(
        const OrderDetailState(
          status: OrderDetailStatus.error,
          failure: OrderFailure.notFound,
        ),
      );
      return;
    }

    emit(const OrderDetailState(status: OrderDetailStatus.loading));
    try {
      final order = await _repository.getOrderById(_orderId);
      emit(OrderDetailState(status: OrderDetailStatus.loaded, order: order));
    } catch (error) {
      emit(
        OrderDetailState(
          status: OrderDetailStatus.error,
          failure: mapOrderFailure(error),
        ),
      );
    }
  }

  Future<void> cancel() async {
    final order = state.order;
    if (order == null || !order.canCancel) return;

    emit(
      state.copyWith(status: OrderDetailStatus.cancelling, clearFailure: true),
    );
    try {
      final cancelledOrder = await _repository.cancelOrder(order.id);
      emit(
        OrderDetailState(
          status: OrderDetailStatus.cancelled,
          order: cancelledOrder,
        ),
      );
    } catch (error) {
      emit(
        state.copyWith(
          status: OrderDetailStatus.loaded,
          failure: mapOrderFailure(error),
        ),
      );
    }
  }

  void dismissFailure() {
    if (state.failure != null) emit(state.copyWith(clearFailure: true));
  }
}
