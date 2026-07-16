import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/orders/data/datasources/order_local_datasource.dart';
import 'package:vnshop_mobile/features/orders/data/datasources/order_remote_datasource.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_item_model.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';
import 'package:vnshop_mobile/features/orders/data/repositories/order_repository_impl.dart';

class MockOrderRemoteDataSource extends Mock implements OrderRemoteDataSource {}

class MockOrderLocalDataSource extends Mock implements OrderLocalDataSource {}

void main() {
  test(
    'detail requests refresh remotely even when a list summary is cached',
    () async {
      final remote = MockOrderRemoteDataSource();
      final local = MockOrderLocalDataSource();
      final cachedSummary = OrderModel(
        id: 'order-1',
        orderNumber: 'order-1',
        status: OrderStatus.pending,
        items: const [],
        subtotal: 0,
        shippingFee: 0,
        totalAmount: 245000,
        createdAt: DateTime.utc(2026, 7, 10),
      );
      final remoteDetail = OrderModel(
        id: 'order-1',
        orderNumber: 'VN-2026-0001',
        status: OrderStatus.confirmed,
        items: const [
          OrderItemModel(
            id: 'product-1:BLACK-128:seller-1',
            productId: 'product-1',
            productName: 'Headphones',
            productImage: '',
            price: 120000,
            quantity: 2,
            totalPrice: 240000,
          ),
        ],
        subtotal: 240000,
        shippingFee: 15000,
        totalAmount: 245000,
        createdAt: DateTime.utc(2026, 7, 16),
      );

      when(
        () => local.getCachedOrder('order-1'),
      ).thenAnswer((_) async => cachedSummary);
      when(
        () => remote.getOrderById('order-1'),
      ).thenAnswer((_) async => remoteDetail);
      when(() => local.cacheOrder(remoteDetail)).thenAnswer((_) async {});

      final repository = OrderRepositoryImpl(
        remoteDataSource: remote,
        localDataSource: local,
      );
      final result = await repository.getOrderById('order-1');

      expect(result.orderNumber, 'VN-2026-0001');
      expect(result.items, hasLength(1));
      verify(() => remote.getOrderById('order-1')).called(1);
      verify(() => local.cacheOrder(remoteDetail)).called(1);
    },
  );
}
