import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/checkout/data/services/vietqr_service.dart';

void main() {
  test('uses the configuration-service VietQR bank destination', () async {
    final service = VietQRService(
      merchantId: 'VNSHOP',
      merchantName: 'VNShop',
      configuration: const VietQRConfiguration(
        bankBin: '970407',
        accountNumber: '0123456789',
        accountName: 'VNSHOP',
      ),
    );

    final payment = await service.generatePayment(amount: 100000, orderId: 'ORD-1');

    expect(payment.bankId, '970407');
    expect(payment.accountNumber, '0123456789');
    expect(payment.qrImageUrl, contains('970407-0123456789'));
  });

  test('fails closed when the configuration-service destination is missing', () {
    expect(
      () => VietQRService(
        merchantId: 'VNSHOP',
        merchantName: 'VNShop',
        configuration: const VietQRConfiguration(
          bankBin: '',
          accountNumber: '',
          accountName: '',
        ),
      ),
      throwsA(isA<StateError>()),
    );
  });
}
