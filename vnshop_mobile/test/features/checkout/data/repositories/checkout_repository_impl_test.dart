import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
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
              {'id': 'sepay', 'name': 'SePay', 'enabled': true},
              {'id': 'vnpay', 'name': 'legacy-a', 'enabled': true},
              {'id': 'momo', 'name': 'legacy-b', 'enabled': true},
              {'id': 'bank_transfer', 'name': 'Bank transfer', 'enabled': true},
              {'id': 'stripe', 'name': 'Card', 'enabled': true},
            ],
          },
        ),
      );

      final methods = await CheckoutRepositoryImpl(
        dio: dio,
      ).getAvailablePaymentMethods();

      expect(methods, [PaymentMethod.cod, PaymentMethod.vietqr, PaymentMethod.sepay]);
    },
  );
}
