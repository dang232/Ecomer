import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/checkout/data/services/vietqr_service.dart';

void main() {
  group('VietQRService', () {
    late VietQRService service;

    setUp(() {
      service = VietQRService(
        merchantId: 'VNshop123',
        merchantName: 'VNShop Store',
        mode: VietQRMode.test,
      );
    });

    group('generatePayment', () {
      test('should generate payment with correct amount and orderId', () async {
        final payment = await service.generatePayment(
          amount: 100000,
          orderId: 'ORD_12345',
        );

        expect(payment.amount, 100000);
        expect(payment.orderId, 'ORD_12345');
        expect(payment.bankId, '970436');
        expect(payment.accountNumber, '1234567890');
      });

      test('should generate valid QR image URL', () async {
        final payment = await service.generatePayment(
          amount: 50000,
          orderId: 'ORD_67890',
        );

        expect(payment.qrImageUrl, contains('img.vietqr.io'));
        expect(payment.qrImageUrl, contains('970436'));
        expect(payment.qrImageUrl, contains('1234567890'));
        expect(payment.qrImageUrl, contains('amount=50000'));
      });

      test('should include description in QR URL when provided', () async {
        final payment = await service.generatePayment(
          amount: 75000,
          orderId: 'ORD_11111',
          description: 'Test payment',
        );

        expect(payment.qrImageUrl, contains('addInfo='));
      });

      test('should use default description when not provided', () async {
        final payment = await service.generatePayment(
          amount: 75000,
          orderId: 'ORD_22222',
        );

        // URL encoded contains spaces as %20
        expect(payment.qrImageUrl, contains('Thanh%20toan%20don%20hang'));
      });

      test('should generate QR data string', () async {
        final payment = await service.generatePayment(
          amount: 200000,
          orderId: 'ORD_33333',
        );

        expect(payment.qrData, isNotEmpty);
        expect(payment.qrData.length, greaterThan(50));
      });
    });

    group('production mode', () {
      test('should use production bank IDs', () async {
        final productionService = VietQRService(
          merchantId: 'MERCHANT_PROD',
          merchantName: 'Production Store',
          mode: VietQRMode.production,
        );

        final payment = await productionService.generatePayment(
          amount: 100000,
          orderId: 'ORD_PROD_001',
        );

        expect(payment.bankId, 'YOUR_BANK_ID');
        expect(payment.accountNumber, 'YOUR_ACCOUNT');
      });
    });
  });

  group('VietQRPayment', () {
    test('should store all properties correctly', () {
      const payment = VietQRPayment(
        qrData: 'test_qr_data',
        qrImageUrl: 'https://img.vietqr.io/test.png',
        amount: 100000,
        orderId: 'ORD_TEST',
        bankId: '970436',
        accountNumber: '1234567890',
      );

      expect(payment.qrData, 'test_qr_data');
      expect(payment.qrImageUrl, 'https://img.vietqr.io/test.png');
      expect(payment.amount, 100000);
      expect(payment.orderId, 'ORD_TEST');
      expect(payment.bankId, '970436');
      expect(payment.accountNumber, '1234567890');
    });
  });

  group('VietQRMode', () {
    test('should have test and production modes', () {
      expect(VietQRMode.values, contains(VietQRMode.test));
      expect(VietQRMode.values, contains(VietQRMode.production));
    });
  });
}
