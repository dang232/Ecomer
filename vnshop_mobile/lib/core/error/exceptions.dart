/// Base exception class
abstract class AppException implements Exception {
  const AppException({
    required this.message,
    this.code,
    this.details,
  });

  final String message;
  final String? code;
  final Map<String, dynamic>? details;

  @override
  String toString() => 'AppException: $message (code: $code)';
}

/// Server/API exception
class ServerException extends AppException {
  const ServerException({
    required super.message,
    super.code,
    super.details,
  });

  factory ServerException.fromStatusCode(int statusCode, [String? message]) {
    switch (statusCode) {
      case 400:
        return ServerException(
          message: message ?? 'Yêu cầu không hợp lệ',
          code: 'BAD_REQUEST',
        );
      case 401:
        return ServerException(
          message: message ?? 'Không được phép truy cập',
          code: 'UNAUTHORIZED',
        );
      case 403:
        return ServerException(
          message: message ?? 'Bị cấm truy cập',
          code: 'FORBIDDEN',
        );
      case 404:
        return ServerException(
          message: message ?? 'Không tìm thấy',
          code: 'NOT_FOUND',
        );
      case 422:
        return ServerException(
          message: message ?? 'Dữ liệu không hợp lệ',
          code: 'UNPROCESSABLE_ENTITY',
        );
      case 429:
        return ServerException(
          message: message ?? 'Quá nhiều yêu cầu',
          code: 'TOO_MANY_REQUESTS',
        );
      case 500:
        return ServerException(
          message: message ?? 'Lỗi máy chủ',
          code: 'INTERNAL_SERVER_ERROR',
        );
      default:
        return ServerException(
          message: message ?? 'Lỗi máy chủ',
          code: 'SERVER_ERROR',
        );
    }
  }
}

/// Network exception (connectivity issues)
class NetworkException extends AppException {
  const NetworkException({
    super.message = 'Không có kết nối mạng',
    super.code = 'NETWORK_ERROR',
  });
}

/// Cache/storage exception
class CacheException extends AppException {
  const CacheException({
    super.message = 'Lỗi bộ nhớ đệm',
    super.code = 'CACHE_ERROR',
  });
}

/// Authentication exception
class AuthException extends AppException {
  const AuthException({
    required super.message,
    super.code,
    super.details,
  });

  factory AuthException.invalidCredentials() {
    return const AuthException(
      message: 'Email hoặc mật khẩu không đúng',
      code: 'INVALID_CREDENTIALS',
    );
  }

  factory AuthException.sessionExpired() {
    return const AuthException(
      message: 'Phiên đăng nhập đã hết hạn',
      code: 'SESSION_EXPIRED',
    );
  }

  factory AuthException.userNotFound() {
    return const AuthException(
      message: 'Không tìm thấy người dùng',
      code: 'USER_NOT_FOUND',
    );
  }

  factory AuthException.emailNotVerified() {
    return const AuthException(
      message: 'Vui lòng xác thực email',
      code: 'EMAIL_NOT_VERIFIED',
    );
  }

  factory AuthException.accountLocked() {
    return const AuthException(
      message: 'Tài khoản đã bị khóa',
      code: 'ACCOUNT_LOCKED',
    );
  }
}

/// Validation exception
class ValidationException extends AppException {
  const ValidationException({
    required super.message,
    super.code = 'VALIDATION_ERROR',
    super.details,
  });

  factory ValidationException.field({
    required String field,
    required String message,
  }) {
    return ValidationException(
      message: message,
      code: 'INVALID_$field',
      details: {'field': field},
    );
  }
}

/// Parsing exception (JSON/data parsing errors)
class ParsingException extends AppException {
  const ParsingException({
    super.message = 'Lỗi phân tích dữ liệu',
    super.code = 'PARSING_ERROR',
    super.details,
  });
}

/// Timeout exception
class TimeoutException extends AppException {
  const TimeoutException({
    super.message = 'Yêu cầu bị timeout',
    super.code = 'TIMEOUT',
  });
}

/// Unknown exception
class UnknownException extends AppException {
  const UnknownException({
    super.message = 'Lỗi không xác định',
    super.code = 'UNKNOWN',
    super.details,
  });
}
