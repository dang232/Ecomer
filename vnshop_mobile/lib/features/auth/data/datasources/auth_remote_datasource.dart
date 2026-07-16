import 'package:dio/dio.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/error/exceptions.dart';
import '../../../../core/network/dio_client.dart';
import '../models/token_set.dart';
import '../models/user_model.dart';

/// Remote data source for authentication API calls
abstract class AuthRemoteDataSource {
  /// Login with email and password
  Future<(TokenSet, UserModel)> login({
    required String email,
    required String password,
  });

  /// Register new user
  Future<(TokenSet, UserModel)> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  });

  /// Refresh access token
  Future<TokenSet> refreshToken(String refreshToken);

  /// Logout (invalidate session on server)
  Future<void> logout(String accessToken);

  /// Get current user profile
  Future<UserModel> getProfile(String accessToken);

  /// Update user profile
  Future<UserModel> updateProfile({
    required String accessToken,
    String? fullName,
    String? phone,
    String? address,
    DateTime? dateOfBirth,
    String? gender,
  });

  /// Change password
  Future<void> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
  });

  /// Forgot password - request reset email
  Future<void> forgotPassword(String email);

  /// Reset password with token
  Future<void> resetPassword({
    required String resetToken,
    required String newPassword,
  });

  /// Resend verification email
  Future<void> resendVerificationEmail(String email);
}

/// Implementation of AuthRemoteDataSource
class AuthRemoteDataSourceImpl implements AuthRemoteDataSource {
  AuthRemoteDataSourceImpl({DioClient? dioClient}) : _dioClient = dioClient ?? DioClient.instance;

  final DioClient _dioClient;

  @override
  Future<(TokenSet, UserModel)> login({
    required String email,
    required String password,
  }) async {
    try {
      final response = await _dioClient.post(
        ApiConstants.login,
        data: {
          'username': email, // Backend expects 'username' field
          'password': password,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        // Backend wraps response in ApiResponse<T> envelope
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;

        // LoginResponse: {accessToken, accessExpiresIn}
        // Refresh token is in HTTP-only cookie, not in response body
        final accessToken = data['accessToken'] as String;
        final accessExpiresIn = data['accessExpiresIn'] as int;

        // Calculate expiry time from seconds
        final accessTokenExpiry = DateTime.now().add(Duration(seconds: accessExpiresIn));

        // For TokenSet, we create without refresh token (it comes from cookie)
        // Use default refresh token expiry of 7 days
        final tokenSet = TokenSet(
          accessToken: accessToken,
          refreshToken: '', // Not provided in response - comes from HTTP-only cookie
          accessTokenExpiry: accessTokenExpiry,
          refreshTokenExpiry: DateTime.now().add(const Duration(days: 7)),
        );

        // Backend doesn't return user in login response - fetch profile separately
        final user = await getProfile(accessToken);
        return (tokenSet, user.copyWith(email: email));
      }

      throw ServerException(
        message: 'Đăng nhập thất bại',
        code: 'LOGIN_FAILED',
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<(TokenSet, UserModel)> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    try {
      // Parse full name into first/last
      final nameParts = fullName.trim().split(' ');
      final firstName = nameParts.isNotEmpty ? nameParts.first : '';
      final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

      final response = await _dioClient.post(
        ApiConstants.register,
        data: {
          'email': email,
          'password': password,
          'firstName': firstName,
          'lastName': lastName,
          'phone': ?phone,
        },
      );

      // Register returns ApiResponse<RegisterResponse> with {userId, email}
      // No tokens returned - user needs to login after registration
      if (response.statusCode == 201 && response.data != null) {
        // Registration successful but no tokens - return empty TokenSet
        // Caller should redirect to login
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;
        final userId = data['userId'] as String;

        // Return empty token set - user must login after register
        final now = DateTime.now();
        final tokenSet = TokenSet(
          accessToken: '',
          refreshToken: '',
          accessTokenExpiry: now,
          refreshTokenExpiry: now,
        );

        // Create minimal user model with the registered email
        final user = UserModel(
          id: userId,
          email: email,
          fullName: fullName,
          phone: phone,
        );

        return (tokenSet, user);
      }

      throw ServerException(
        message: 'Đăng ký thất bại',
        code: 'REGISTER_FAILED',
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<TokenSet> refreshToken(String refreshToken) async {
    try {
      // Refresh token is read from HTTP-only cookie on backend
      // No body needed - just call the endpoint
      final response = await _dioClient.post(
        ApiConstants.refreshToken,
        options: Options(headers: await _dioClient.csrfHeaders()),
      );

      if (response.statusCode == 200 && response.data != null) {
        // Backend wraps response in ApiResponse<T> envelope
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;

        // LoginResponse: {accessToken, accessExpiresIn}
        final accessToken = data['accessToken'] as String;
        final accessExpiresIn = data['accessExpiresIn'] as int;

        // Calculate expiry time from seconds
        final accessTokenExpiry = DateTime.now().add(Duration(seconds: accessExpiresIn));

        // Return TokenSet with new access token
        // Refresh token stays in HTTP-only cookie, we keep the old one
        return TokenSet(
          accessToken: accessToken,
          refreshToken: refreshToken, // Keep existing refresh token
          accessTokenExpiry: accessTokenExpiry,
          refreshTokenExpiry: DateTime.now().add(const Duration(days: 7)),
        );
      }

      throw AuthException.sessionExpired();
    } on DioException catch (e) {
      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        throw AuthException.sessionExpired();
      }
      throw _handleDioException(e);
    }
  }

  @override
  Future<void> logout(String accessToken) async {
    try {
      await _dioClient.post(
        ApiConstants.logout,
        options: Options(
          headers: {
            ...await _dioClient.csrfHeaders(),
            ApiConstants.authorization: '${ApiConstants.bearer} $accessToken',
          },
        ),
      );
    } on DioException catch (e) {
      // Logout should not fail - just clear local data
      // ignore: avoid_print
      print('Logout API call failed: $e');
    }
  }

  @override
  Future<UserModel> getProfile(String accessToken) async {
    try {
      final response = await _dioClient.get(
        ApiConstants.profile,
        options: Options(
          headers: {
            ApiConstants.authorization: '${ApiConstants.bearer} $accessToken',
          },
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        // Backend wraps response in ApiResponse<T> envelope
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;

        // BuyerProfileResponse: { keycloakId, name, phone, avatarUrl, banned, addresses }
        return UserModel(
          id: data['keycloakId'] as String? ?? '',
          email: '', // Not in profile response, must be set from login context
          fullName: data['name'] as String?,
          phone: data['phone'] as String?,
          avatarUrl: data['avatarUrl'] as String?,
        );
      }

      throw ServerException(
        message: 'Không thể lấy thông tin người dùng',
        code: 'GET_PROFILE_FAILED',
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<UserModel> updateProfile({
    required String accessToken,
    String? fullName,
    String? phone,
    String? address,
    DateTime? dateOfBirth,
    String? gender,
  }) async {
    try {
      final response = await _dioClient.put(
        ApiConstants.updateProfile,
        data: {
          'name': ?fullName,
          'phone': ?phone,
        },
        options: Options(
          headers: {
            ApiConstants.authorization: '${ApiConstants.bearer} $accessToken',
          },
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        final envelope = response.data as Map<String, dynamic>;
        final data = envelope['data'] as Map<String, dynamic>;
        return UserModel(
          id: data['keycloakId'] as String? ?? '',
          email: data['email'] as String? ?? '',
          fullName: data['name'] as String?,
          phone: data['phone'] as String?,
          avatarUrl: data['avatarUrl'] as String?,
        );
      }

      throw ServerException(
        message: 'Không thể cập nhật thông tin người dùng',
        code: 'UPDATE_PROFILE_FAILED',
      );
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<void> changePassword({
    required String accessToken,
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final response = await _dioClient.post(
        ApiConstants.changePassword,
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
        options: Options(
          headers: {
            ApiConstants.authorization: '${ApiConstants.bearer} $accessToken',
          },
        ),
      );

      if (response.statusCode != 200) {
        throw ServerException(
          message: 'Không thể đổi mật khẩu',
          code: 'CHANGE_PASSWORD_FAILED',
        );
      }
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<void> forgotPassword(String email) async {
    try {
      final response = await _dioClient.post(
        ApiConstants.forgotPassword,
        data: {'email': email},
      );

      if (response.statusCode != 200) {
        throw ServerException(
          message: 'Không thể gửi yêu cầu đặt lại mật khẩu',
          code: 'FORGOT_PASSWORD_FAILED',
        );
      }
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<void> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    try {
      final response = await _dioClient.post(
        ApiConstants.resetPassword,
        data: {
          'reset_token': resetToken,
          'new_password': newPassword,
        },
      );

      if (response.statusCode != 200) {
        throw ServerException(
          message: 'Không thể đặt lại mật khẩu',
          code: 'RESET_PASSWORD_FAILED',
        );
      }
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  @override
  Future<void> resendVerificationEmail(String email) async {
    try {
      final response = await _dioClient.post(
        ApiConstants.resendVerification,
        data: {'email': email},
      );

      if (response.statusCode != 200) {
        throw ServerException(
          message: 'Không thể gửi email xác thực',
          code: 'RESEND_VERIFICATION_FAILED',
        );
      }
    } on DioException catch (e) {
      throw _handleDioException(e);
    }
  }

  /// Handle DioException and convert to appropriate AppException
  AppException _handleDioException(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const TimeoutException();

      case DioExceptionType.connectionError:
        return const NetworkException();

      case DioExceptionType.badResponse:
        final statusCode = e.response?.statusCode ?? 0;
        final message = _extractErrorMessage(e.response?.data);

        // Handle specific auth errors
        if (statusCode == 401) {
          return AuthException.sessionExpired();
        }

        // Handle validation errors (422)
        if (statusCode == 422) {
          return ValidationException(
            message: message ?? 'Dữ liệu không hợp lệ',
            details: e.response?.data as Map<String, dynamic>?,
          );
        }

        return ServerException.fromStatusCode(statusCode, message);

      case DioExceptionType.cancel:
        return const UnknownException(message: 'Yêu cầu bị hủy');

      default:
        return UnknownException(message: e.message ?? 'Lỗi không xác định');
    }
  }

  /// Extract error message from response data
  String? _extractErrorMessage(dynamic data) {
    if (data == null) return null;

    if (data is Map<String, dynamic>) {
      // Try common error message fields
      return data['message'] as String? ??
          data['error'] as String? ??
          data['error_message'] as String?;
    }

    return null;
  }
}
