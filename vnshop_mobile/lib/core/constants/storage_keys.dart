/// Storage key constants for flutter_secure_storage
/// Used to store sensitive data like tokens securely
class StorageKeys {
  StorageKeys._();

  /// Keys for authentication tokens
  static const String accessToken = 'vnshop_access_token';
  static const String refreshToken = 'vnshop_refresh_token';
  static const String tokenExpiry = 'vnshop_token_expiry';

  /// Keys for user data
  static const String userId = 'vnshop_user_id';
  static const String userEmail = 'vnshop_user_email';
  static const String userData = 'vnshop_user_data';

  /// Keys for app state
  static const String isFirstLaunch = 'vnshop_first_launch';
  static const String lastSyncTime = 'vnshop_last_sync';
  static const String onboardingCompleted = 'vnshop_onboarding_completed';

  /// Keys for settings
  static const String themeMode = 'vnshop_theme_mode';
  static const String languageCode = 'vnshop_language_code';
  static const String notificationEnabled = 'vnshop_notification_enabled';

  /// Keys for cart (backup)
  static const String cartData = 'vnshop_cart_data';

  /// Keys for device info
  static const String deviceId = 'vnshop_device_id';
  static const String fcmToken = 'vnshop_fcm_token';

  /// All auth-related keys (for clearing on logout)
  static const List<String> authKeys = [
    accessToken,
    refreshToken,
    tokenExpiry,
    userId,
    userEmail,
    userData,
  ];

  /// All keys that should be cleared on logout
  static const List<String> logoutClearKeys = [
    accessToken,
    refreshToken,
    tokenExpiry,
    userId,
    userEmail,
    userData,
    cartData,
  ];
}
