import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:vnshop_mobile/features/checkout/data/models/checkout_session.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/data/repositories/checkout_repository_impl.dart';

class MockDio extends Mock implements Dio {}

class FakeOptions extends Fake implements Options {}

void main() {
  setUpAll(() {
    registerFallbackValue(FakeOptions());
  });

  test(
    'loads only supported enabled payment methods from the backend',
    () async {
      final dio = MockDio();
      when(
        () => dio.get('/payment/methods', options: any(named: 'options')),
      ).thenAnswer(
        (_) async => Response(
          requestOptions: RequestOptions(path: '/payment/methods'),
          statusCode: 200,
          data: const {
            'success': true,
            'data': [
              {'id': 'cod', 'name': 'Cash on Delivery', 'enabled': true},
              {'id': 'vietqr', 'name': 'VietQR', 'enabled': true},
              {'id': 'momo', 'name': 'MoMo', 'enabled': false},
              {'id': 'stripe', 'name': 'Card', 'enabled': true},
            ],
          },
        ),
      );

      final methods = await CheckoutRepositoryImpl(
        dio: dio,
      ).getAvailablePaymentMethods();

      expect(methods, [PaymentMethod.cod, PaymentMethod.vietqr]);
    },
  );

  test('serializes the applied coupon when creating an order', () async {
    final dio = MockDio();
    when(
      () => dio.post(
        '/orders',
        options: any(named: 'options'),
        data: any(named: 'data'),
      ),
    ).thenAnswer(
      (_) async => Response(
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 201,
        data: const {
          'success': true,
          'data': {'id': 'order-1'},
        },
      ),
    );

    final session = CheckoutSession.create(
      userId: 'buyer-1',
      lineItems: const [LineItem(productId: 'product-1', quantity: 1)],
      subtotal: 500000,
      discountAmount: 50000,
      couponCode: 'SAVE10',
    );
    final transaction = PaymentTransaction(
      id: 'payment-1',
      orderId: 'order-1',
      idempotencyKey: 'payment-key',
      method: PaymentMethod.vietqr,
      status: PaymentStatus.pending,
      amount: 450000,
      createdAt: DateTime(2026),
    );

    await CheckoutRepositoryImpl(dio: dio).createOrder(
      session: session,
      transaction: transaction,
      idempotencyKey: 'order-key',
    );

    final body = verify(
      () => dio.post(
        '/orders',
        options: any(named: 'options'),
        data: captureAny(named: 'data'),
      ),
    ).captured.single as Map<String, dynamic>;
    expect(body['couponCode'], 'SAVE10');
  });
}
