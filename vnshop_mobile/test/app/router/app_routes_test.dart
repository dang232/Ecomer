import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/app/router/app_routes.dart';
import 'dart:io';

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
      expect(AppRoutes.requiresAuthentication(Uri.parse('/promotions')), isFalse);
      expect(AppRoutes.requiresAuthentication(Uri.parse('/categories')), isFalse);
    });

    test('exposes all implemented destination routes', () {
      expect(AppRoutes.categories, '/categories');
      expect(AppRoutes.promotions, '/promotions');
      expect(AppRoutes.addresses, '/addresses');
      expect(AppRoutes.paymentMethods, '/payment-methods');
      expect(AppRoutes.notifications, '/notifications');
      expect(AppRoutes.help, '/help');
    });

    test('does not keep scoped placeholder destinations', () {
      final routerSource = File(
        'lib/app/router/app_router.dart',
      ).readAsStringSync();

      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Danh mục')")));
      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Khuyến mãi')")));
      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Địa chỉ')")));
      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Thanh toán')")));
      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Thông báo')")));
      expect(routerSource, isNot(contains("PlaceholderPage(title: 'Trợ giúp')")));
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
