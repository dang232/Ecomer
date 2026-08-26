import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';
import 'package:vnshop_mobile/features/checkout/presentation/widgets/sepay_section.dart';
import 'package:vnshop_mobile/common/widgets/images/safe_network_image.dart';

void main() {
  testWidgets('renders SePay QR instructions and status action', (tester) async {
    var checked = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SepaySection(
            transaction: PaymentTransaction(
              id: 'payment-1',
              orderId: 'order-1',
              idempotencyKey: 'key-1',
              method: PaymentMethod.sepay,
              status: PaymentStatus.pending,
              amount: 150000,
              qrCodeUrl: 'https://example.com/qr.png',
              createdAt: DateTime(2026),
            ),
            onCheckStatus: () => checked = true,
          ),
        ),
      ),
    );

    expect(find.text('Thanh toán SePay'), findsOneWidget);
    expect(find.textContaining('Quét mã QR'), findsOneWidget);
    expect(find.textContaining('Đang chờ'), findsOneWidget);
    expect(find.byType(SafeNetworkImage), findsOneWidget);
    await tester.tap(find.text('Kiểm tra trạng thái'));
    expect(checked, isTrue);
  });
}
