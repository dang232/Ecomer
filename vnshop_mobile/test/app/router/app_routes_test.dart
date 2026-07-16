import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/app/router/app_routes.dart';

void main() {
  group('AppRoutes', () {
    test('builds encoded product and order detail locations', () {
      expect(AppRoutes.productDetail('sku/blue'), '/product/sku%2Fblue');
      expect(AppRoutes.orderDetail('order 42'), '/orders/order%2042');
    });

    test('protects nested checkout and account routes', () {
      expect(
        AppRoutes.requiresAuthentication(Uri.parse('/checkout/address/new')),
        isTrue,
      );
      expect(
        AppRoutes.requiresAuthentication(Uri.parse('/orders/order-1')),
        isTrue,
      );
      expect(AppRoutes.requiresAuthentication(Uri.parse('/profile')), isTrue);
      expect(
        AppRoutes.requiresAuthentication(Uri.parse('/product/product-1')),
        isFalse,
      );
    });

    test('sends guests to login with a safe next location', () {
      final redirect = AppRoutes.redirectFor(
        location: Uri.parse('/checkout/address/new?source=cart'),
        isAuthenticated: false,
      );

      expect(
        redirect,
        '/login?next=%2Fcheckout%2Faddress%2Fnew%3Fsource%3Dcart',
      );
    });

    test('restores a safe next location after login', () {
      final redirect = AppRoutes.redirectFor(
        location: Uri.parse('/login?next=%2Forders%2Forder-1'),
        isAuthenticated: true,
      );

      expect(redirect, '/orders/order-1');
    });

    test('rejects external and protocol-relative next locations', () {
      expect(AppRoutes.safeNextLocation('https://example.com/steal'), isNull);
      expect(AppRoutes.safeNextLocation('//example.com/steal'), isNull);
      expect(AppRoutes.safeNextLocation('/orders'), '/orders');
    });
  });
}
