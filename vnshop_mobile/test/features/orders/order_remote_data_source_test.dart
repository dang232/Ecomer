import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/orders/data/datasources/order_remote_datasource.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';

class MockDio extends Mock implements Dio {}

void main() {
  test('reads orders from the paginated API envelope', () async {
    final dio = MockDio();
    when(
      () => dio.get('/orders', queryParameters: any(named: 'queryParameters')),
    ).thenAnswer(
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

    final page = await OrderRemoteDataSourceImpl(dio: dio).getOrders();

    expect(page.orders, hasLength(1));
    expect(page.orders.single.id, 'order-1');
  });

  test(
    'preserves Spring page metadata and sends the canonical status filter',
    () async {
      final dio = MockDio();
      when(
        () =>
            dio.get('/orders', queryParameters: any(named: 'queryParameters')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/orders'),
          statusCode: 200,
          data: const {
            'success': true,
            'data': {
              'content': <Map<String, dynamic>>[],
              'number': 1,
              'size': 20,
              'totalElements': 45,
              'totalPages': 3,
              'last': false,
            },
          },
        ),
      );

      final page = await OrderRemoteDataSourceImpl(
        dio: dio,
      ).getOrders(page: 2, status: OrderStatus.confirmed);

      expect(page.page, 2);
      expect(page.pageSize, 20);
      expect(page.totalElements, 45);
      expect(page.totalPages, 3);
      expect(page.hasNext, isTrue);
      verify(
        () => dio.get(
          '/orders',
          queryParameters: {'page': 1, 'size': 20, 'status': 'CONFIRMED'},
        ),
      ).called(1);
    },
  );

  test('decodes the real nested order-detail response', () async {
    final dio = MockDio();
    when(() => dio.get('/orders/order-1')).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/orders/order-1'),
        statusCode: 200,
        data: const {
          'success': true,
          'data': {
            'id': 'order-1',
            'orderNumber': 'VN-2026-0001',
            'buyerId': 'buyer-1',
            'shippingAddress': {
              'street': '12 Nguyen Hue',
              'ward': 'Ben Nghe',
              'district': 'District 1',
              'city': 'Ho Chi Minh City',
            },
            'subOrders': [
              {
                'subOrderId': 7,
                'sellerId': 'seller-1',
                'fulfillmentStatus': 'ACCEPTED',
                'shippingCost': {'amount': 15000, 'currency': 'VND'},
                'shippingMethod': 'standard',
                'carrier': 'GHN',
                'trackingNumber': 'TRACK-001',
                'items': [
                  {
                    'productId': 'product-1',
                    'variantSku': 'BLACK-128',
                    'sellerId': 'seller-1',
                    'name': 'A very long product name',
                    'quantity': 2,
                    'unitPrice': {'amount': 120000, 'currency': 'VND'},
                    'imageUrl': 'https://example.com/product.jpg',
                  },
                ],
              },
              {
                'subOrderId': 8,
                'sellerId': 'seller-2',
                'fulfillmentStatus': 'PACKED',
                'shippingCost': {'amount': 0, 'currency': 'VND'},
                'items': <Map<String, dynamic>>[],
              },
            ],
            'itemsTotal': {'amount': 240000, 'currency': 'VND'},
            'shippingTotal': {'amount': 15000, 'currency': 'VND'},
            'discount': {'amount': 10000, 'currency': 'VND'},
            'finalAmount': {'amount': 245000, 'currency': 'VND'},
            'paymentMethod': 'VIETQR',
            'paymentStatus': 'COMPLETED',
            'idempotencyKey': 'checkout-key',
          },
        },
      ),
    );

    final order = await OrderRemoteDataSourceImpl(
      dio: dio,
    ).getOrderById('order-1');

    expect(order.id, 'order-1');
    expect(order.orderNumber, 'VN-2026-0001');
    expect(order.status, OrderStatus.confirmed);
    expect(order.items, hasLength(1));
    expect(order.items.single.productId, 'product-1');
    expect(order.items.single.variantSku, 'BLACK-128');
    expect(order.items.single.price, 120000);
    expect(order.items.single.totalPrice, 240000);
    expect(order.subtotal, 240000);
    expect(order.shippingFee, 15000);
    expect(order.discount, 10000);
    expect(order.totalAmount, 245000);
    expect(
      order.fullShippingAddress,
      '12 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
    );
    expect(order.trackingNumber, 'TRACK-001');
    expect(order.carrier, 'GHN');
    expect(order.paymentMethod, 'VIETQR');
    expect(order.paymentStatus, 'COMPLETED');
    expect(order.isPaid, isTrue);
  });
}
