import 'package:equatable/equatable.dart';

import '../../data/models/user_model.dart';

/// Base class for all authentication states
class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.errorMessage,
    this.errorCode,
  });

  final AuthStatus status;
  final UserModel? user;
  final String? errorMessage;
  final String? errorCode;

  /// Initial state - checking auth status
  static const AuthState initial = AuthState(status: AuthStatus.initial);

  /// Authenticated state with user
  const AuthState.authenticated({
    required UserModel user,
  }) : this(
          status: AuthStatus.authenticated,
          user: user,
        );

  /// Unauthenticated state
  const AuthState.unauthenticated({
    String? errorMessage,
    String? errorCode,
  }) : this(
          status: AuthStatus.unauthenticated,
          errorMessage: errorMessage,
          errorCode: errorCode,
        );

  /// Loading state
  const AuthState.loading({
    UserModel? user,
  }) : this(
          status: AuthStatus.loading,
          user: user,
        );

  /// Session expired state
  const AuthState.expired({
    String? errorMessage,
  }) : this(
          status: AuthStatus.expired,
          errorMessage: errorMessage ?? 'Phiên đăng nhập đã hết hạn',
        );

  /// Error state
  const AuthState.error({
    required String message,
    String? code,
  }) : this(
          status: AuthStatus.error,
          errorMessage: message,
          errorCode: code,
        );

  /// Copy with method for immutable state updates
  AuthState copyWith({
    AuthStatus? status,
    UserModel? user,
    String? errorMessage,
    String? errorCode,
    bool clearError = false,
    bool clearUser = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: clearUser ? null : (user ?? this.user),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      errorCode: clearError ? null : (errorCode ?? this.errorCode),
    );
  }

  /// Check if user is authenticated
  bool get isAuthenticated => status == AuthStatus.authenticated;

  /// Check if state is loading
  bool get isLoading => status == AuthStatus.loading;

  /// Check if session is expired
  bool get isExpired => status == AuthStatus.expired;

  /// Check if user is admin
  bool get isAdmin => user?.role == UserRole.admin;

  @override
  List<Object?> get props => [status, user, errorMessage, errorCode];

  @override
  String toString() {
    return 'AuthState(status: $status, user: ${user?.email ?? 'null'}, '
        'error: $errorMessage)';
  }
}

/// Authentication status enum
enum AuthStatus {
  /// Initial state - checking auth status
  initial,

  /// User is authenticated
  authenticated,

  /// User is not authenticated
  unauthenticated,

  /// Session expired
  expired,

  /// Loading/auth in progress
  loading,

  /// Error occurred
  error,
}

/// Extension for AuthStatus
extension AuthStatusExtension on AuthStatus {
  /// Get Vietnamese label for status
  String get label {
    switch (this) {
      case AuthStatus.initial:
        return 'Đang kiểm tra...';
      case AuthStatus.authenticated:
        return 'Đã đăng nhập';
      case AuthStatus.unauthenticated:
        return 'Chưa đăng nhập';
      case AuthStatus.expired:
        return 'Phiên đã hết hạn';
      case AuthStatus.loading:
        return 'Đang xử lý...';
      case AuthStatus.error:
        return 'Có lỗi xảy ra';
    }
  }
}
