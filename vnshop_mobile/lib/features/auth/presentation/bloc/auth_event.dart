import 'package:equatable/equatable.dart';

/// Base class for all authentication events
abstract class AuthEvent extends Equatable {
  const AuthEvent();

  @override
  List<Object?> get props => [];
}

/// Check initial auth state (e.g., on app start)
class AuthCheckRequested extends AuthEvent {
  const AuthCheckRequested();
}

/// Login with email and password
class AuthLoginRequested extends AuthEvent {
  const AuthLoginRequested({
    required this.email,
    required this.password,
  });

  final String email;
  final String password;

  @override
  List<Object?> get props => [email, password];
}

/// Register new user
class AuthRegisterRequested extends AuthEvent {
  const AuthRegisterRequested({
    required this.email,
    required this.password,
    required this.fullName,
    this.phone,
  });

  final String email;
  final String password;
  final String fullName;
  final String? phone;

  @override
  List<Object?> get props => [email, password, fullName, phone];
}

/// Logout current user
class AuthLogoutRequested extends AuthEvent {
  const AuthLogoutRequested();
}

/// Refresh session/token
class AuthRefreshRequested extends AuthEvent {
  const AuthRefreshRequested();
}

/// Session expired event (internal)
class AuthSessionExpired extends AuthEvent {
  const AuthSessionExpired();
}

/// Forgot password request
class AuthForgotPasswordRequested extends AuthEvent {
  const AuthForgotPasswordRequested({
    required this.email,
  });

  final String email;

  @override
  List<Object?> get props => [email];
}

/// Reset password
class AuthResetPasswordRequested extends AuthEvent {
  const AuthResetPasswordRequested({
    required this.resetToken,
    required this.newPassword,
  });

  final String resetToken;
  final String newPassword;

  @override
  List<Object?> get props => [resetToken, newPassword];
}

/// Update user profile
class AuthUpdateProfileRequested extends AuthEvent {
  const AuthUpdateProfileRequested({
    this.fullName,
    this.phone,
    this.address,
    this.dateOfBirth,
    this.gender,
  });

  final String? fullName;
  final String? phone;
  final String? address;
  final DateTime? dateOfBirth;
  final String? gender;

  @override
  List<Object?> get props => [fullName, phone, address, dateOfBirth, gender];
}

/// Change password
class AuthChangePasswordRequested extends AuthEvent {
  const AuthChangePasswordRequested({
    required this.currentPassword,
    required this.newPassword,
  });

  final String currentPassword;
  final String newPassword;

  @override
  List<Object?> get props => [currentPassword, newPassword];
}

/// Resend verification email
class AuthResendVerificationRequested extends AuthEvent {
  const AuthResendVerificationRequested({
    required this.email,
  });

  final String email;

  @override
  List<Object?> get props => [email];
}
