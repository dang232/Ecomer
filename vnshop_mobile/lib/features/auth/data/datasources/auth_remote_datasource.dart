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
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final tokenSet = TokenSet.fromJson(data['tokens'] as Map<String, dynamic>);
        final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
        return (tokenSet, user);
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
      final response = await _dioClient.post(
        ApiConstants.register,
        data: {
          'email': email,
          'password': password,
          'full_name': fullName,
          if (phone != null) 'phone': phone,
        },
      );

      if (response.statusCode == 201 && response.data != null) {
        final data = response.data as Map<String, dynamic>;
        final tokenSet = TokenSet.fromJson(data['tokens'] as Map<String, dynamic>);
        final user = UserModel.fromJson(data['user'] as Map<String, dynamic>);
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
      final response = await Dio().post(
        '${ApiConstants.baseUrlWithVersion}${ApiConstants.refreshToken}',
        data: {'refresh_token': refreshToken},
      );

      if (response.statusCode == 200 && response.data != null) {
        return TokenSet.fromJson(response.data as Map<String, dynamic>);
      }

      throw AuthException.sessionExpired();
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
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
        return UserModel.fromJson(response.data as Map<String, dynamic>);
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
      final response = await _dioClient.patch(
        ApiConstants.updateProfile,
        data: {
          if (fullName != null) 'full_name': fullName,
          if (phone != null) 'phone': phone,
          if (address != null) 'address': address,
          if (dateOfBirth != null) 'date_of_birth': dateOfBirth.toIso8601String(),
          if (gender != null) 'gender': gender,
        },
        options: Options(
          headers: {
            ApiConstants.authorization: '${ApiConstants.bearer} $accessToken',
          },
        ),
      );

      if (response.statusCode == 200 && response.data != null) {
        return UserModel.fromJson(response.data as Map<String, dynamic>);
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
