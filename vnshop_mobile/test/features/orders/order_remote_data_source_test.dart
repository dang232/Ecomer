import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/orders/data/datasources/order_remote_datasource.dart';

class MockDio extends Mock implements Dio {}

void main() {
  test('reads orders from the paginated API envelope', () async {
    final dio = MockDio();
    when(() => dio.get(
          '/orders',
          queryParameters: any(named: 'queryParameters'),
        )).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 200,
        data: const {
          'success': true,
          'data': {
            'content': [
              {
                'orderId': 'order-1',
                'status': 'PENDING',
                'totalAmount': 100000,
                'createdAt': '2026-07-13T00:00:00Z',
              },
            ],
          },
        },
      ),
    );

    final orders = await OrderRemoteDataSourceImpl(dio: dio).getOrders();

    expect(orders, hasLength(1));
    expect(orders.single.id, 'order-1');
  });
}
