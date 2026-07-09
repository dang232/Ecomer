import 'package:equatable/equatable.dart';

/// Base failure class following Either/Result pattern
abstract class Failure extends Equatable {
  const Failure({
    required this.message,
    this.code,
    this.details,
  });

  final String message;
  final String? code;
  final Map<String, dynamic>? details;

  @override
  List<Object?> get props => [message, code, details];
}

/// Server-side failure (API errors)
class ServerFailure extends Failure {
  const ServerFailure({
    required super.message,
    super.code,
    super.details,
  });

  factory ServerFailure.fromStatusCode(int statusCode, [String? message]) {
    switch (statusCode) {
      case 400:
        return ServerFailure(
          message: message ?? 'Yêu cầu không hợp lệ',
          code: 'BAD_REQUEST',
        );
      case 401:
        return ServerFailure(
          message: message ?? 'Phiên đăng nhập đã hết hạn',
          code: 'UNAUTHORIZED',
        );
      case 403:
        return ServerFailure(
          message: message ?? 'Bạn không có quyền thực hiện thao tác này',
          code: 'FORBIDDEN',
        );
      case 404:
        return ServerFailure(
          message: message ?? 'Không tìm thấy tài nguyên',
          code: 'NOT_FOUND',
        );
      case 422:
        return ServerFailure(
          message: message ?? 'Dữ liệu không hợp lệ',
          code: 'UNPROCESSABLE_ENTITY',
        );
      case 429:
        return ServerFailure(
          message: message ?? 'Quá nhiều yêu cầu, vui lòng thử lại sau',
          code: 'TOO_MANY_REQUESTS',
        );
      case 500:
        return ServerFailure(
          message: message ?? 'Lỗi máy chủ, vui lòng thử lại sau',
          code: 'INTERNAL_SERVER_ERROR',
        );
      case 502:
        return ServerFailure(
          message: message ?? 'Dịch vụ tạm thời không khả dụng',
          code: 'BAD_GATEWAY',
        );
      case 503:
        return ServerFailure(
          message: message ?? 'Dịch vụ tạm thời không khả dụng',
          code: 'SERVICE_UNAVAILABLE',
        );
      default:
        return ServerFailure(
          message: message ?? 'Đã xảy ra lỗi, vui lòng thử lại',
          code: 'SERVER_ERROR',
        );
    }
  }
}

/// Network connectivity failure
class NetworkFailure extends Failure {
  const NetworkFailure({
    super.message = 'Không có kết nối mạng, vui lòng kiểm tra kết nối',
    super.code = 'NETWORK_ERROR',
  });
}

/// Cache/storage failure
class CacheFailure extends Failure {
  const CacheFailure({
    super.message = 'Không thể truy cập bộ nhớ đệm',
    super.code = 'CACHE_ERROR',
  });
}

/// Authentication failure
class AuthFailure extends Failure {
  const AuthFailure({
    required super.message,
    super.code,
    super.details,
  });

  factory AuthFailure.invalidCredentials() {
    return const AuthFailure(
      message: 'Email hoặc mật khẩu không đúng',
      code: 'INVALID_CREDENTIALS',
    );
  }

  factory AuthFailure.sessionExpired() {
    return const AuthFailure(
      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
      code: 'SESSION_EXPIRED',
    );
  }

  factory AuthFailure.userNotFound() {
    return const AuthFailure(
      message: 'Không tìm thấy người dùng',
      code: 'USER_NOT_FOUND',
    );
  }

  factory AuthFailure.emailNotVerified() {
    return const AuthFailure(
      message: 'Vui lòng xác thực email trước khi đăng nhập',
      code: 'EMAIL_NOT_VERIFIED',
    );
  }

  factory AuthFailure.accountLocked() {
    return const AuthFailure(
      message: 'Tài khoản đã bị khóa do đăng nhập sai nhiều lần',
      code: 'ACCOUNT_LOCKED',
    );
  }

  factory AuthFailure.invalidToken() {
    return const AuthFailure(
      message: 'Token không hợp lệ',
      code: 'INVALID_TOKEN',
    );
  }
}

/// Validation failure
class ValidationFailure extends Failure {
  const ValidationFailure({
    required super.message,
    super.code = 'VALIDATION_ERROR',
    super.details,
  });

  factory ValidationFailure.email(String message) {
    return ValidationFailure(
      message: message,
      code: 'INVALID_EMAIL',
    );
  }

  factory ValidationFailure.password(String message) {
    return ValidationFailure(
      message: message,
      code: 'INVALID_PASSWORD',
    );
  }

  factory ValidationFailure.phone(String message) {
    return ValidationFailure(
      message: message,
      code: 'INVALID_PHONE',
    );
  }

  factory ValidationFailure.required(String field) {
    return ValidationFailure(
      message: 'Trường $field không được để trống',
      code: 'REQUIRED_FIELD',
    );
  }
}

/// Unknown/unexpected failure
class UnknownFailure extends Failure {
  const UnknownFailure({
    super.message = 'Đã xảy ra lỗi không xác định',
    super.code = 'UNKNOWN_ERROR',
    super.details,
  });
}

/// Result type alias for cleaner code
/// Usage: Future<Result<User>> login(...)
/// 
/// Returns either Left(Failure) on error or Right(T) on success
typedef Result<T> = Future<Either<Failure, T>>;

/// Either type
class Either<L, R> {
  const Either._(this._value, this._isRight);

  /// Left factory constructor
  factory Either.left(L value) => Either<L, R>._(value, false);

  /// Right factory constructor
  factory Either.right(R value) => Either<L, R>._(value, true);

  final dynamic _value;
  final bool _isRight;

  bool get isLeft => !_isRight;
  bool get isRight => _isRight;

  L? get leftValue => isLeft ? _value as L : null;
  R? get rightValue => isRight ? _value as R : null;

  T fold<T>(T Function(L failure) onFailure, T Function(R success) onSuccess) {
    if (isLeft) {
      return onFailure(leftValue as L);
    }
    return onSuccess(rightValue as R);
  }
}
