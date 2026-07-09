import 'dart:async';

import 'package:flutter_bloc/flutter_bloc.dart';

import '../../domain/repositories/auth_repository.dart';
import 'auth_event.dart';
import 'auth_state.dart';

/// BLoC for managing authentication state
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required AuthRepository authRepository,
  })  : _authRepository = authRepository,
        super(const AuthState()) {
    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<AuthLoginRequested>(_onAuthLoginRequested);
    on<AuthRegisterRequested>(_onAuthRegisterRequested);
    on<AuthLogoutRequested>(_onAuthLogoutRequested);
    on<AuthRefreshRequested>(_onAuthRefreshRequested);
    on<AuthSessionExpired>(_onAuthSessionExpired);
    on<AuthForgotPasswordRequested>(_onAuthForgotPasswordRequested);
    on<AuthResetPasswordRequested>(_onAuthResetPasswordRequested);
    on<AuthUpdateProfileRequested>(_onAuthUpdateProfileRequested);
    on<AuthChangePasswordRequested>(_onAuthChangePasswordRequested);
    on<AuthResendVerificationRequested>(_onAuthResendVerificationRequested);

    // Listen to auth state changes from repository
    _authSubscription = _authRepository.authStateChanges.listen(_onRepositoryAuthStateChange);
  }

  final AuthRepository _authRepository;
  late final StreamSubscription<AuthState> _authSubscription;

  /// Handle auth state changes from repository
  void _onRepositoryAuthStateChange(AuthState authState) {
    if (authState.isAuthenticated) {
      // Update local state with user from repository
      _authRepository.getStoredUser().then((user) {
        if (user != null && !isClosed) {
          // ignore: invalid_use_of_visible_for_testing_member
          emit(AuthState.authenticated(user: user));
        }
      });
    } else if (authState.status == AuthStatus.unauthenticated) {
      // ignore: invalid_use_of_visible_for_testing_member
      emit(const AuthState(status: AuthStatus.unauthenticated));
    } else if (authState.status == AuthStatus.expired) {
      // ignore: invalid_use_of_visible_for_testing_member
      emit(const AuthState(status: AuthStatus.expired));
    }
  }

  /// Check and restore auth state on app start
  Future<void> _onAuthCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final isLoggedIn = await _authRepository.isLoggedIn();

    if (isLoggedIn) {
      final user = await _authRepository.getStoredUser();
      if (user != null) {
        emit(AuthState.authenticated(user: user));
        return;
      }

      // Try to fetch user from API
      final result = await _authRepository.getCurrentUser();
      result.fold(
        (failure) => emit(const AuthState(status: AuthStatus.unauthenticated)),
        (user) => emit(AuthState.authenticated(user: user)),
      );
    } else {
      emit(const AuthState(status: AuthStatus.unauthenticated));
    }
  }

  /// Handle login request
  Future<void> _onAuthLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.login(
      email: event.email,
      password: event.password,
    );

    result.fold(
      (failure) => emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (user) => emit(AuthState.authenticated(user: user)),
    );
  }

  /// Handle register request
  Future<void> _onAuthRegisterRequested(
    AuthRegisterRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.register(
      email: event.email,
      password: event.password,
      fullName: event.fullName,
      phone: event.phone,
    );

    result.fold(
      (failure) => emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (user) => emit(AuthState.authenticated(user: user)),
    );
  }

  /// Handle logout request
  Future<void> _onAuthLogoutRequested(
    AuthLogoutRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    await _authRepository.logout();
    emit(const AuthState(status: AuthStatus.unauthenticated));
  }

  /// Handle token refresh request
  Future<void> _onAuthRefreshRequested(
    AuthRefreshRequested event,
    Emitter<AuthState> emit,
  ) async {
    final result = await _authRepository.refreshSession();

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.expired,
        errorMessage: failure.message,
      )),
      (_) {
        // Refresh successful - user stays authenticated
        if (state.user != null) {
          emit(AuthState.authenticated(user: state.user!));
        }
      },
    );
  }

  /// Handle session expired event
  Future<void> _onAuthSessionExpired(
    AuthSessionExpired event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.expired));
  }

  /// Handle forgot password request
  Future<void> _onAuthForgotPasswordRequested(
    AuthForgotPasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.forgotPassword(event.email);

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.unauthenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (_) => emit(state.copyWith(
        status: AuthStatus.unauthenticated,
        clearError: true,
      )),
    );
  }

  /// Handle reset password request
  Future<void> _onAuthResetPasswordRequested(
    AuthResetPasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.resetPassword(
      resetToken: event.resetToken,
      newPassword: event.newPassword,
    );

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.error,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (_) => emit(const AuthState(status: AuthStatus.unauthenticated)),
    );
  }

  /// Handle profile update request
  Future<void> _onAuthUpdateProfileRequested(
    AuthUpdateProfileRequested event,
    Emitter<AuthState> emit,
  ) async {
    if (state.user == null) return;

    emit(state.copyWith(status: AuthStatus.loading));

    final result = await _authRepository.updateProfile(
      fullName: event.fullName,
      phone: event.phone,
      address: event.address,
      dateOfBirth: event.dateOfBirth,
      gender: event.gender,
    );

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (user) => emit(AuthState.authenticated(user: user)),
    );
  }

  /// Handle change password request
  Future<void> _onAuthChangePasswordRequested(
    AuthChangePasswordRequested event,
    Emitter<AuthState> emit,
  ) async {
    if (state.user == null) return;

    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.changePassword(
      currentPassword: event.currentPassword,
      newPassword: event.newPassword,
    );

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (_) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        clearError: true,
      )),
    );
  }

  /// Handle resend verification email request
  Future<void> _onAuthResendVerificationRequested(
    AuthResendVerificationRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading, clearError: true));

    final result = await _authRepository.resendVerificationEmail(event.email);

    result.fold(
      (failure) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        errorMessage: failure.message,
        errorCode: failure.code,
      )),
      (_) => emit(state.copyWith(
        status: AuthStatus.authenticated,
        clearError: true,
      )),
    );
  }

  @override
  Future<void> close() {
    _authSubscription.cancel();
    return super.close();
  }
}
