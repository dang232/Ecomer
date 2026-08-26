import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/features/profile/presentation/pages/account_destination_page.dart';

void main() {
  testWidgets('renders each account destination without a placeholder', (tester) async {
    const destinations = [
      ('Địa chỉ giao hàng', Icons.location_on_outlined),
      ('Phương thức thanh toán', Icons.payment_outlined),
      ('Thông báo', Icons.notifications_outlined),
      ('Trợ giúp', Icons.help_outline),
    ];

    for (final (title, icon) in destinations) {
      await tester.pumpWidget(
        MaterialApp(
          home: AccountDestinationPage(title: title, icon: icon, message: 'Nội dung'),
        ),
      );
      expect(find.text(title), findsWidgets);
      expect(find.byIcon(icon), findsOneWidget);
    }
  });
}
