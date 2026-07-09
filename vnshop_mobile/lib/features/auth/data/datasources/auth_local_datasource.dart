import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../../core/constants/storage_keys.dart';
import '../../../../core/error/exceptions.dart';
import '../models/token_set.dart';
import '../models/user_model.dart';

/// Local data source for authentication using flutter_secure_storage
abstract class AuthLocalDataSource {
  /// Get stored access token
  Future<String?> getAccessToken();

  /// Get stored refresh token
  Future<String?> getRefreshToken();

  /// Get stored token expiry
  Future<DateTime?> getTokenExpiry();

  /// Get stored user
  Future<UserModel?> getUser();

  /// Save tokens to secure storage
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  });

  /// Save user data
  Future<void> saveUser(UserModel user);

  /// Clear all auth data (logout)
  Future<void> clearAuthData();

  /// Check if user is logged in
  Future<bool> isLoggedIn();

  /// Get full token set
  Future<TokenSet?> getTokenSet();
}

/// Implementation of AuthLocalDataSource using flutter_secure_storage
class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  AuthLocalDataSourceImpl({FlutterSecureStorage? secureStorage})
      : _secureStorage = secureStorage ?? const FlutterSecureStorage(
          aOptions: AndroidOptions(
            encryptedSharedPreferences: true,
          ),
          iOptions: IOSOptions(
            accessibility: KeychainAccessibility.first_unlock_this_device,
          ),
        );

  final FlutterSecureStorage _secureStorage;

  @override
  Future<String?> getAccessToken() async {
    try {
      return await _secureStorage.read(key: StorageKeys.accessToken);
    } catch (e) {
      throw CacheException(message: 'Không thể đọc access token: $e');
    }
  }

  @override
  Future<String?> getRefreshToken() async {
    try {
      return await _secureStorage.read(key: StorageKeys.refreshToken);
    } catch (e) {
      throw CacheException(message: 'Không thể đọc refresh token: $e');
    }
  }

  @override
  Future<DateTime?> getTokenExpiry() async {
    try {
      final expiryString = await _secureStorage.read(key: StorageKeys.tokenExpiry);
      if (expiryString == null) return null;
      return DateTime.tryParse(expiryString);
    } catch (e) {
      throw CacheException(message: 'Không thể đọc token expiry: $e');
    }
  }

  @override
  Future<UserModel?> getUser() async {
    try {
      final userData = await _secureStorage.read(key: StorageKeys.userData);
      if (userData == null) return null;
      return UserModel.fromJsonString(userData);
    } catch (e) {
      // User data might not exist yet
      return null;
    }
  }

  @override
  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    required DateTime accessTokenExpiry,
    DateTime? refreshTokenExpiry,
  }) async {
    try {
      await Future.wait([
        _secureStorage.write(
          key: StorageKeys.accessToken,
          value: accessToken,
        ),
        _secureStorage.write(
          key: StorageKeys.refreshToken,
          value: refreshToken,
        ),
        _secureStorage.write(
          key: StorageKeys.tokenExpiry,
          value: accessTokenExpiry.toIso8601String(),
        ),
        if (refreshTokenExpiry != null)
          _secureStorage.write(
            key: '${StorageKeys.refreshToken}_expiry',
            value: refreshTokenExpiry.toIso8601String(),
          ),
      ]);
    } catch (e) {
      throw CacheException(message: 'Không thể lưu tokens: $e');
    }
  }

  @override
  Future<void> saveUser(UserModel user) async {
    try {
      await _secureStorage.write(
        key: StorageKeys.userData,
        value: user.toJsonString(),
      );
      await _secureStorage.write(
        key: StorageKeys.userId,
        value: user.id,
      );
      await _secureStorage.write(
        key: StorageKeys.userEmail,
        value: user.email,
      );
    } catch (e) {
      throw CacheException(message: 'Không thể lưu user data: $e');
    }
  }

  @override
  Future<void> clearAuthData() async {
    try {
      await Future.wait(
        StorageKeys.logoutClearKeys.map(
          (key) => _secureStorage.delete(key: key),
        ),
      );
    } catch (e) {
      throw CacheException(message: 'Không thể xóa auth data: $e');
    }
  }

  @override
  Future<bool> isLoggedIn() async {
    try {
      final accessToken = await getAccessToken();
      final tokenExpiry = await getTokenExpiry();

      if (accessToken == null || tokenExpiry == null) {
        return false;
      }

      // Check if token is expired
      if (DateTime.now().isAfter(tokenExpiry)) {
        return false;
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  @override
  Future<TokenSet?> getTokenSet() async {
    try {
      final accessToken = await getAccessToken();
      final refreshToken = await getRefreshToken();
      final expiry = await getTokenExpiry();

      if (accessToken == null || refreshToken == null || expiry == null) {
        return null;
      }

      // Get refresh token expiry if available
      String? refreshExpiryStr;
      try {
        refreshExpiryStr = await _secureStorage.read(
          key: '${StorageKeys.refreshToken}_expiry',
        );
      } catch (_) {}

      return TokenSet(
        accessToken: accessToken,
        refreshToken: refreshToken,
        accessTokenExpiry: expiry,
        refreshTokenExpiry:
            refreshExpiryStr != null ? DateTime.tryParse(refreshExpiryStr) : null,
      );
    } catch (e) {
      return null;
    }
  }
}
