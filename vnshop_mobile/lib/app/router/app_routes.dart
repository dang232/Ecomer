abstract final class AppRoutes {
  static const home = '/';
  static const login = '/login';
  static const register = '/register';
  static const products = '/products';
  static const categories = '/categories';
  static const promotions = '/promotions';
  static const cart = '/cart';
  static const checkout = '/checkout';
  static const checkoutAddressNew = '$checkout/address/new';
  static const orders = '/orders';
  static const profile = '/profile';
  static const settings = '/settings';
  static const favorites = '/favorites';
  static const addresses = '/addresses';
  static const paymentMethods = '/payment-methods';
  static const notifications = '/notifications';
  static const help = '/help';

  static const _protectedRoots = <String>{
    checkout,
    orders,
    profile,
    settings,
    favorites,
    addresses,
    paymentMethods,
    notifications,
  };

  static String productDetail(String productId) =>
      '/product/${Uri.encodeComponent(productId)}';

  static String orderDetail(String orderId) =>
      '$orders/${Uri.encodeComponent(orderId)}';

  static String checkoutAddress(String addressId) =>
      '$checkout/address/${Uri.encodeComponent(addressId)}';

  static bool requiresAuthentication(Uri location) {
    final path = location.path;
    return _protectedRoots.any(
      (root) => path == root || path.startsWith('$root/'),
    );
  }

  static String? redirectFor({
    required Uri location,
    required bool isAuthenticated,
  }) {
    if (!isAuthenticated && requiresAuthentication(location)) {
      return Uri(
        path: login,
        queryParameters: <String, String>{'next': location.toString()},
      ).toString();
    }

    if (isAuthenticated && location.path == login) {
      return safeNextLocation(location.queryParameters['next']) ?? home;
    }

    return null;
  }

  static String? safeNextLocation(String? candidate) {
    if (candidate == null ||
        candidate.isEmpty ||
        !candidate.startsWith('/') ||
        candidate.startsWith('//')) {
      return null;
    }

    final parsed = Uri.tryParse(candidate);
    if (parsed == null ||
        parsed.hasScheme ||
        parsed.hasAuthority ||
        parsed.path == login) {
      return null;
    }

    return parsed.toString();
  }
}
