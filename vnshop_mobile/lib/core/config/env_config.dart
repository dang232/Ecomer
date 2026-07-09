import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Environment configuration for VNShop Mobile
/// All values are loaded from .env file or environment variables
class EnvConfig {
  EnvConfig._();

  static bool _initialized = false;

  /// Initialize environment configuration
  /// Must be called before using any env values
  static Future<void> initialize() async {
    if (_initialized) return;

    try {
      await dotenv.load(fileName: '.env');
      _initialized = true;
      debugPrint('✅ EnvConfig initialized');
    } catch (e) {
      debugPrint('⚠️ Failed to load .env file: $e');
      // Continue with defaults
      _initialized = true;
    }
  }

  /// Get string value from environment
  static String get(String key, {String defaultValue = ''}) {
    return dotenv.env[key] ?? defaultValue;
  }

  /// Get bool value from environment
  static bool getBool(String key, {bool defaultValue = false}) {
    final value = dotenv.env[key]?.toLowerCase();
    if (value == null) return defaultValue;
    return value == 'true' || value == '1' || value == 'yes';
  }

  /// Get int value from environment
  static int getInt(String key, {int defaultValue = 0}) {
    return int.tryParse(dotenv.env[key] ?? '') ?? defaultValue;
  }

  // =========================================================================
  // API Configuration
  // =========================================================================

  /// Base URL for the API Gateway
  /// Default: http://host.docker.internal:8080 (for local Docker dev)
  static String get apiBaseUrl => get(
        'API_BASE_URL',
        defaultValue: 'http://host.docker.internal:8080',
      );

  /// API Version prefix
  static String get apiVersion => get('API_VERSION', defaultValue: 'v1');

  /// Full base URL with version
  static String get apiBaseUrlWithVersion =>
      '$apiBaseUrl/$apiVersion';

  // =========================================================================
  // Keycloak Configuration
  // =========================================================================

  /// Keycloak URL
  static String get keycloakUrl =>
      get('KEYCLOAK_URL', defaultValue: 'http://localhost:8085');

  /// Keycloak Realm
  static String get keycloakRealm =>
      get('KEYCLOAK_REALM', defaultValue: 'vnshop');

  /// Keycloak Client ID
  static String get keycloakClientId =>
      get('KEYCLOAK_CLIENT_ID', defaultValue: 'vnshop-api');

  // =========================================================================
  // OneSignal Configuration
  // =========================================================================

  /// OneSignal App ID
  static String get onesignalAppId =>
      get('ONESIGNAL_APP_ID', defaultValue: '');

  /// Whether OneSignal is enabled
  static bool get onesignalEnabled =>
      onesignalAppId.isNotEmpty;

  // =========================================================================
  // App Configuration
  // =========================================================================

  /// App environment
  static String get appEnv =>
      get('APP_ENV', defaultValue: 'development');

  /// Whether to use mock backend
  static bool get useMockBackend =>
      getBool('USE_MOCK_BACKEND', defaultValue: false);

  /// Whether to enable verbose logging
  static bool get debugLogging =>
      getBool('DEBUG_LOGGING', defaultValue: false);

  /// Check if running in development
  static bool get isDevelopment => appEnv == 'development';

  /// Check if running in production
  static bool get isProduction => appEnv == 'production';

  /// Check if running in staging
  static bool get isStaging => appEnv == 'staging';
}
