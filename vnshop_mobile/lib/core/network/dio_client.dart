import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

import '../constants/api_constants.dart';

/// Singleton Dio client for VNShop API
class DioClient {
  DioClient._();

  static final DioClient _instance = DioClient._();
  static DioClient get instance => _instance;

  late final Dio _dio;
  AuthInterceptor? _authInterceptor;
  CookieJar? _cookieJar;
  bool _isInitialized = false;

  /// Initialize the Dio client with dependencies
  /// Must be called before making any API calls
  void initialize({
    required Future<String?> Function() getAccessToken,
    required Future<String?> Function() getRefreshToken,
    required Future<void> Function(String, String) saveTokens,
    required Future<void> Function() clearTokens,
    required void Function() onSessionExpired,
    CookieJar? cookieJar,
  }) {
    _cookieJar = cookieJar ?? CookieJar();
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrlWithVersion,
        connectTimeout: ApiConstants.connectTimeout,
        receiveTimeout: ApiConstants.receiveTimeout,
        sendTimeout: ApiConstants.sendTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    _authInterceptor = AuthInterceptor(
      dio: _dio,
      getAccessToken: getAccessToken,
      getRefreshToken: getRefreshToken,
      saveTokens: saveTokens,
      clearTokens: clearTokens,
      onSessionExpired: onSessionExpired,
      getCsrfHeaders: csrfHeaders,
    );

    _dio.interceptors.addAll([
      CookieManager(_cookieJar!),
      _authInterceptor!,
      LogInterceptor(
        requestBody: false,
        responseBody: false,
        requestHeader: true,
        responseHeader: true,
        error: true,
        logPrint: (object) {
          // ponytail: production logging should use a proper service
          // ignore: avoid_print
          print('[DioClient] ${_redactSensitiveData(object)}');
        },
      ),
    ]);
    _isInitialized = true;
  }

  /// Redact sensitive fields from log output
  String _redactSensitiveData(Object object) {
    String str = object.toString();
    const sensitiveKeys = [
      'password',
      'access_token',
      'refresh_token',
      'authorization',
      'bearer',
      'token',
      'secret',
      'apikey',
      'api_key',
    ];
    for (final key in sensitiveKeys) {
      final regex = RegExp(
        '$key["\']?\\s*[:=]\\s*["\']?([^"\'&\\s,}]+)',
        caseSensitive: false,
      );
      str = str.replaceAllMapped(regex, (m) {
        final parts = m.group(0)!.split('=');
        return '${parts[0].trim()}=[REDACTED]';
      });
    }
    return str;
  }

  /// Get the Dio instance for making API calls
  Dio get dio {
    if (!_isInitialized) {
      throw StateError(
        'DioClient not initialized. Call DioClient.instance.initialize() first.',
      );
    }
    return _dio;
  }

  /// Check if client is initialized
  bool get isInitialized => _isInitialized && _authInterceptor != null;

  /// Reset auth interceptor state (useful after logout)
  void resetAuthState() {
    _authInterceptor?.reset();
    unawaited(_cookieJar?.deleteAll());
  }

  /// Return the double-submit CSRF header for cookie-authenticated auth calls.
  Future<Map<String, String>> csrfHeaders() async {
    final jar = _cookieJar;
    if (jar == null) return const {};

    final cookies = await jar.loadForRequest(
       Uri.parse('${ApiConstants.baseUrlWithVersion}/auth/refresh'),
    );
    for (final cookie in cookies) {
      if (cookie.name == 'vnshop_csrf' && cookie.value.isNotEmpty) {
        return {ApiConstants.csrfToken: cookie.value};
      }
    }
    return const {};
  }

  /// Dispose the client (for testing or cleanup)
  void dispose() {
    _dio.close();
    _authInterceptor = null;
    _isInitialized = false;
  }

  /// Convenience method for GET requests
  Future<Response<T>> get<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return dio.get<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// Convenience method for POST requests
  Future<Response<T>> post<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return dio.post<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// Convenience method for PUT requests
  Future<Response<T>> put<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return dio.put<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// Convenience method for PATCH requests
  Future<Response<T>> patch<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return dio.patch<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }

  /// Convenience method for DELETE requests
  Future<Response<T>> delete<T>(
    String path, {
    Object? data,
    Map<String, dynamic>? queryParameters,
    Options? options,
    CancelToken? cancelToken,
  }) {
    return dio.delete<T>(
      path,
      data: data,
      queryParameters: queryParameters,
      options: options,
      cancelToken: cancelToken,
    );
  }
}

/// Auth interceptor that handles token injection and automatic refresh
/// Uses single-flight pattern to prevent concurrent refresh requests
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required this._dio,
    required this._getAccessToken,
    required this._getRefreshToken,
    required this._saveTokens,
    required this._clearTokens,
    required this._onSessionExpired,
    required this._getCsrfHeaders,
  });

  final Dio _dio;
  final Future<String?> Function() _getAccessToken;
  final Future<String?> Function() _getRefreshToken;
  final Future<void> Function(String, String) _saveTokens;
  final Future<void> Function() _clearTokens;
  final void Function() _onSessionExpired;
  final Future<Map<String, String>> Function() _getCsrfHeaders;

  /// Single-flight completer for token refresh
  Completer<void>? _inFlightRefresh;
  bool _sessionExpiredHandled = false;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for auth endpoints
    if (_isAuthEndpoint(options.path)) {
      return handler.next(options);
    }

    final accessToken = await _getAccessToken();

    if (accessToken != null) {
      options.headers[ApiConstants.authorization] =
          '${ApiConstants.bearer} $accessToken';
    }

    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Only handle 401 errors for non-auth endpoints
    if (err.response?.statusCode != 401 || _isAuthEndpoint(err.requestOptions.path)) {
      return handler.next(err);
    }

    // Prevent concurrent refresh attempts using single-flight pattern
    if (_inFlightRefresh != null) {
      await _inFlightRefresh!.future;
      
      // If session was expired during refresh, propagate the error
      if (_sessionExpiredHandled) {
        return handler.next(err);
      }
      
      // Retry the original request
      final opts = err.requestOptions;
      final accessToken = await _getAccessToken();
      if (accessToken != null) {
        opts.headers[ApiConstants.authorization] =
            '${ApiConstants.bearer} $accessToken';
      }
      
      try {
        final response = await _dio.fetch(opts);
        return handler.resolve(response);
      } catch (e) {
        return handler.next(e as DioException);
      }
    }

    // Start new refresh attempt
    _inFlightRefresh = Completer<void>();
    _sessionExpiredHandled = false;

    try {
      final newTokens = await _refreshTokens();

      if (newTokens != null) {
        // Save new tokens
        await _saveTokens(newTokens.accessToken, newTokens.refreshToken);

        // Retry the original request with new token
        final opts = err.requestOptions;
        opts.headers[ApiConstants.authorization] =
            '${ApiConstants.bearer} ${newTokens.accessToken}';

        final response = await _dio.fetch(opts);
        return handler.resolve(response);
      } else {
        // Refresh failed - session expired
        _sessionExpiredHandled = true;
        await _clearTokens();
        _onSessionExpired();
        return handler.next(err);
      }
    } catch (e) {
      _sessionExpiredHandled = true;
      await _clearTokens();
      _onSessionExpired();
      return handler.next(err);
    } finally {
      _inFlightRefresh?.complete();
      _inFlightRefresh = null;
    }
  }

  /// Checks if the endpoint is an authentication endpoint (no token needed)
  bool _isAuthEndpoint(String path) {
    const authEndpoints = [
      '/auth/login',
      '/auth/register',
      '/auth/refresh',
      '/auth/logout',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
      '/auth/resend-verification',
    ];

    return authEndpoints.any((endpoint) => path.contains(endpoint));
  }

  /// Refreshes tokens using the refresh token
  /// Note: Refresh token is stored in HTTP-only cookie on backend, not in body
  Future<_TokenPair?> _refreshTokens() async {
    final refreshToken = await _getRefreshToken();

    try {
      // Refresh endpoint reads token from HTTP-only cookie - no body needed
      final response = await _dio.post(
        ApiConstants.refreshToken,
        options: Options(headers: await _getCsrfHeaders()),
      );

      if (response.statusCode == 200 && response.data != null) {
        // Backend wraps response in ApiResponse<T> envelope
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>?;

        // LoginResponse: {accessToken, accessExpiresIn}
        final newAccessToken = data?['accessToken'] as String?;

        if (newAccessToken != null) {
          // Return new access token, keep existing refresh token (it stays in cookie)
          return _TokenPair(newAccessToken, refreshToken ?? '');
        }
      }

      return null;
    } on DioException {
      return null;
    }
  }

  /// Resets the interceptor state (useful for logout)
  void reset() {
    _inFlightRefresh?.complete();
    _inFlightRefresh = null;
    _sessionExpiredHandled = false;
  }
}

/// Internal class to hold token pair
class _TokenPair {
  const _TokenPair(this.accessToken, this.refreshToken);

  final String accessToken;
  final String refreshToken;
}
