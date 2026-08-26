import '../config/env_config.dart';

/// API endpoint constants for VNShop backend
/// All values are loaded from environment configuration
class ApiConstants {
  ApiConstants._();

  /// Base URL for the API - configured via environment
  static String get baseUrl => EnvConfig.apiBaseUrl;

  /// API version prefix
  static String get apiVersion => EnvConfig.apiVersion;

  /// Full base URL with version
  static String get baseUrlWithVersion => EnvConfig.apiBaseUrlWithVersion;

  // Gateway routes are rooted at the configured host. Dio owns the host, so
  // endpoint constants stay relative and never accidentally add /v1.
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';
  static const String verifyEmail = '/auth/verify-email';
  static const String resendVerification = '/auth/resend-verification';

  // User endpoints
  static const String profile = '/users/me';
  static const String updateProfile = '/users/me';
  // P1: backend exposes password change on the same /users/me resource, not a
  // top-level /users/change-password route (which doesn't exist on the gateway)
  static const String changePassword = '/users/me/password';

  // Product endpoints
  static const String products = '/products';
  static const String productDetail = '/products';
  static const String categories = '/categories';
  static const String search = '/search';
  static const String featuredProducts = '/products/featured';

  // Cart endpoints
  static const String cart = '/cart';
  static const String addToCart = '/cart/items';
  static const String updateCartItem = '/cart/items';
  static const String removeCartItem = '/cart/items';

  // Order endpoints
  static const String orders = '/orders';
  static const String orderDetail = '/orders';
  static const String cancelOrder = '/orders';

  // Address endpoints
  static const String addresses = '/users/me/addresses';
  static const String defaultAddress = '/users/me/addresses/default';

  // Review endpoints
  static const String reviews = '/reviews';
  static const String productReviews = '/products';

  // Payment endpoints (using existing backend routes)
  static const String paymentVnpay = '/payment/vnpay/create';
  static const String paymentMomo = '/payment/momo/create';
  static const String paymentVietqr = '/payment/vietqr/create';
  static const String paymentStatus = '/payment/status';

  // Shipping endpoints
  static const String shippingQuotes = '/shipping/quotes';
  static const String shippingProviders = '/shipping/providers';

  /// Timeout durations
  static const Duration connectTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  static const Duration sendTimeout = Duration(seconds: 30);

  /// Token refresh buffer - refresh token before it expires
  static const Duration refreshBuffer = Duration(minutes: 5);

  /// Maximum retry attempts for token refresh
  static const int maxRefreshAttempts = 1;

  /// Headers
  static const String contentType = 'application/json';
  static const String accept = 'application/json';
  static const String authorization = 'Authorization';
  static const String bearer = 'Bearer';
  static const String idempotencyKey = 'Idempotency-Key';
  static const String csrfToken = 'X-CSRF-Token';
}
