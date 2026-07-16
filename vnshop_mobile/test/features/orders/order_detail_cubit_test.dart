import 'package:bloc_test/bloc_test.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';
import 'package:vnshop_mobile/features/orders/domain/repositories/order_repository.dart';
import 'package:vnshop_mobile/features/orders/presentation/bloc/order_detail_cubit.dart';
import 'package:vnshop_mobile/features/orders/presentation/models/order_failure.dart';

class MockDetailOrderRepository extends Mock implements OrderRepository {}

OrderModel _order(OrderStatus status) => OrderModel(
  id: 'order-1',
  orderNumber: 'VN-0001',
  status: status,
  items: const [],
  subtotal: 100000,
  shippingFee: 15000,
  totalAmount: 115000,
  createdAt: DateTime.utc(2026, 7, 15),
);

void main() {
  late MockDetailOrderRepository repository;

  setUp(() {
    repository = MockDetailOrderRepository();
  });

  blocTest<OrderDetailCubit, OrderDetailState>(
    'loads the routed order from the repository',
    build: () {
      when(
        () => repository.getOrderById('order-1'),
      ).thenAnswer((_) async => _order(OrderStatus.confirmed));
      return OrderDetailCubit(orderId: 'order-1', repository: repository);
    },
    act: (cubit) => cubit.load(),
    expect: () => [
      const OrderDetailState(status: OrderDetailStatus.loading),
      isA<OrderDetailState>()
          .having((state) => state.status, 'status', OrderDetailStatus.loaded)
          .having(
            (state) => state.order?.status,
            'order status',
            OrderStatus.confirmed,
          ),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'classifies load errors for localized retry UI',
    build: () {
      when(() => repository.getOrderById('order-1')).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/orders/order-1'),
          response: Response(
            requestOptions: RequestOptions(path: '/orders/order-1'),
            statusCode: 404,
          ),
          type: DioExceptionType.badResponse,
        ),
      );
      return OrderDetailCubit(orderId: 'order-1', repository: repository);
    },
    act: (cubit) => cubit.load(),
    expect: () => [
      const OrderDetailState(status: OrderDetailStatus.loading),
      const OrderDetailState(
        status: OrderDetailStatus.error,
        failure: OrderFailure.notFound,
      ),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'cancels an eligible loaded order and keeps the returned detail',
    build: () {
      when(
        () => repository.cancelOrder('order-1'),
      ).thenAnswer((_) async => _order(OrderStatus.cancelled));
      return OrderDetailCubit(orderId: 'order-1', repository: repository);
    },
    seed: () => OrderDetailState(
      status: OrderDetailStatus.loaded,
      order: _order(OrderStatus.pending),
    ),
    act: (cubit) => cubit.cancel(),
    expect: () => [
      isA<OrderDetailState>().having(
        (state) => state.status,
        'status',
        OrderDetailStatus.cancelling,
      ),
      isA<OrderDetailState>()
          .having(
            (state) => state.status,
            'status',
            OrderDetailStatus.cancelled,
          )
          .having(
            (state) => state.order?.status,
            'order status',
            OrderStatus.cancelled,
          ),
    ],
  );

  blocTest<OrderDetailCubit, OrderDetailState>(
    'does not call cancellation for a shipped order',
    build: () => OrderDetailCubit(orderId: 'order-1', repository: repository),
    seed: () => OrderDetailState(
      status: OrderDetailStatus.loaded,
      order: _order(OrderStatus.shipped),
    ),
    act: (cubit) => cubit.cancel(),
    expect: () => const <OrderDetailState>[],
    verify: (_) => verifyNever(() => repository.cancelOrder(any())),
  );
}
