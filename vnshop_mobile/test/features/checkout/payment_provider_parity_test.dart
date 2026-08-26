import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_method.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';

void main() {
  test('exposes only the live COD, VietQR, and SePay methods', () {
    expect(
      getAvailablePaymentMethods(),
      const [PaymentMethod.cod, PaymentMethod.vietqr, PaymentMethod.sepay],
    );
    expect(getAvailablePaymentMethods(), isNot(contains(PaymentMethod.momo)));
    expect(getAvailablePaymentMethods(), isNot(contains(PaymentMethod.vnpay)));
  });

  test('maps SePay to its explicit checkout label', () {
    expect(PaymentMethod.sepay.displayNameVi, 'SePay');
    expect(PaymentMethod.sepay.displayName, 'SePay');
  });
}
