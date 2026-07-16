import 'package:bloc_test/bloc_test.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_page_result.dart';
import 'package:vnshop_mobile/features/orders/domain/repositories/order_repository.dart';
import 'package:vnshop_mobile/features/orders/presentation/bloc/order_list_bloc.dart';
import 'package:vnshop_mobile/features/orders/presentation/models/order_failure.dart';

class MockOrderRepository extends Mock implements OrderRepository {}

class FakeOrderModel extends Fake implements OrderModel {}

OrderModel _order(String id, OrderStatus status) => OrderModel(
  id: id,
  orderNumber: id,
  status: status,
  items: const [],
  subtotal: 0,
  shippingFee: 0,
  totalAmount: 100000,
  createdAt: DateTime.utc(2026, 7, 15),
  summaryItemCount: 2,
);

void main() {
  late MockOrderRepository repository;

  setUpAll(() {
    registerFallbackValue(FakeOrderModel());
  });

  setUp(() {
    repository = MockOrderRepository();
  });

  blocTest<OrderListBloc, OrderListState>(
    'keeps authoritative page totals instead of deriving them from content',
    build: () {
      when(
        () => repository.getOrders(
          page: 1,
          limit: 20,
          status: null,
          forceRefresh: false,
        ),
      ).thenAnswer(
        (_) async => OrderPageResult(
          orders: [_order('order-1', OrderStatus.pending)],
          page: 1,
          pageSize: 20,
          totalElements: 45,
          totalPages: 3,
          hasNext: true,
        ),
      );
      return OrderListBloc(orderRepository: repository);
    },
    act: (bloc) => bloc.add(const LoadOrdersEvent()),
    expect: () => [
      const OrderListState(status: OrderListStatus.loading),
      isA<OrderListState>()
          .having((state) => state.status, 'status', OrderListStatus.loaded)
          .having((state) => state.orders.length, 'orders', 1)
          .having((state) => state.totalElements, 'totalElements', 45)
          .having((state) => state.hasReachedMax, 'hasReachedMax', false),
    ],
  );

  blocTest<OrderListBloc, OrderListState>(
    'passes the selected server filter and keeps the returned page unchanged',
    build: () {
      when(
        () => repository.getOrders(
          page: 1,
          limit: 20,
          status: OrderStatus.confirmed,
          forceRefresh: false,
        ),
      ).thenAnswer(
        (_) async => OrderPageResult.singlePage([
          _order('order-packed', OrderStatus.confirmed),
        ]),
      );
      return OrderListBloc(orderRepository: repository);
    },
    act: (bloc) =>
        bloc.add(const ChangeStatusFilterEvent(OrderStatus.confirmed)),
    verify: (_) {
      verify(
        () => repository.getOrders(
          page: 1,
          limit: 20,
          status: OrderStatus.confirmed,
          forceRefresh: false,
        ),
      ).called(1);
    },
    expect: () => [
      isA<OrderListState>()
          .having((state) => state.status, 'status', OrderListStatus.loading)
          .having(
            (state) => state.statusFilter,
            'statusFilter',
            OrderStatus.confirmed,
          ),
      isA<OrderListState>()
          .having((state) => state.status, 'status', OrderListStatus.loaded)
          .having((state) => state.orders.single.id, 'order', 'order-packed'),
    ],
  );

  blocTest<OrderListBloc, OrderListState>(
    'caches the updated notification status rather than the stale order',
    setUp: () {
      when(() => repository.cacheOrder(any())).thenAnswer((_) async {});
    },
    build: () => OrderListBloc(orderRepository: repository),
    seed: () => OrderListState(
      status: OrderListStatus.loaded,
      orders: [_order('order-1', OrderStatus.pending)],
      totalElements: 1,
      hasReachedMax: true,
    ),
    act: (bloc) => bloc.add(
      const UpdateOrderFromNotificationEvent(
        orderId: 'order-1',
        newStatus: OrderStatus.shipped,
      ),
    ),
    verify: (_) {
      final cached = verify(() => repository.cacheOrder(captureAny())).captured;
      expect(cached.single, isA<OrderModel>());
      expect((cached.single as OrderModel).status, OrderStatus.shipped);
    },
    expect: () => [
      isA<OrderListState>().having(
        (state) => state.orders.single.status,
        'status',
        OrderStatus.shipped,
      ),
    ],
  );

  blocTest<OrderListBloc, OrderListState>(
    'exposes a typed network failure for localization in the view layer',
    build: () {
      when(
        () => repository.getOrders(
          page: 1,
          limit: 20,
          status: null,
          forceRefresh: false,
        ),
      ).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/orders'),
          type: DioExceptionType.connectionError,
        ),
      );
      return OrderListBloc(orderRepository: repository);
    },
    act: (bloc) => bloc.add(const LoadOrdersEvent()),
    expect: () => [
      const OrderListState(status: OrderListStatus.loading),
      isA<OrderListState>()
          .having((state) => state.status, 'status', OrderListStatus.error)
          .having((state) => state.failure, 'failure', OrderFailure.network),
    ],
  );
}
