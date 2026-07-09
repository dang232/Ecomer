import 'dart:async';

import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failures.dart';
import '../../../../core/network/dio_client.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/token_set.dart';
import '../models/user_model.dart';
import '../../presentation/bloc/auth_state.dart';

/// Implementation of AuthRepository
class AuthRepositoryImpl implements AuthRepository {
  AuthRepositoryImpl({
    required AuthLocalDataSource localDataSource,
    required AuthRemoteDataSource remoteDataSource,
    DioClient? dioClient,
  })  : _localDataSource = localDataSource,
        _remoteDataSource = remoteDataSource,
        _dioClient = dioClient ?? DioClient.instance;

  final AuthLocalDataSource _localDataSource;
  final AuthRemoteDataSource _remoteDataSource;
  final DioClient _dioClient;

  final _authStateController = StreamController<AuthState>.broadcast();

  @override
  Stream<AuthState> get authStateChanges => _authStateController.stream;

  /// Emit new auth state
  void _emitAuthState(AuthState state) {
    if (!_authStateController.isClosed) {
      _authStateController.add(state);
    }
  }

  @override
  Future<bool> isLoggedIn() async {
    return await _localDataSource.isLoggedIn();
  }

  @override
  Future<UserModel?> getStoredUser() async {
    return await _localDataSource.getUser();
  }

  @override
  Future<Either<Failure, UserModel>> login({
    required String email,
    required String password,
  }) async {
    try {
      _emitAuthState(const AuthState(status: AuthStatus.loading));

      final (tokenSet, user) = await _remoteDataSource.login(
        email: email,
        password: password,
      );

      // Save tokens and user locally
      await _saveAuthData(tokenSet, user);

      _emitAuthState(AuthState.authenticated(user: user));
      return Either.right(user);
    } on AuthException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(_mapAuthExceptionToFailure(e));
    } on ValidationException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(ValidationFailure(
        message: e.message,
        code: e.code,
        details: e.details,
      ));
    } on NetworkException {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, UserModel>> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
  }) async {
    try {
      _emitAuthState(const AuthState(status: AuthStatus.loading));

      final (tokenSet, user) = await _remoteDataSource.register(
        email: email,
        password: password,
        fullName: fullName,
        phone: phone,
      );

      // Save tokens and user locally
      await _saveAuthData(tokenSet, user);

      _emitAuthState(AuthState.authenticated(user: user));
      return Either.right(user);
    } on AuthException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(_mapAuthExceptionToFailure(e));
    } on ValidationException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(ValidationFailure(
        message: e.message,
        code: e.code,
        details: e.details,
      ));
    } on NetworkException {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> logout() async {
    try {
      _emitAuthState(const AuthState(status: AuthStatus.loading));

      // Try to logout on server (but don't fail if it doesn't work)
      final accessToken = await _localDataSource.getAccessToken();
      if (accessToken != null) {
        try {
          await _remoteDataSource.logout(accessToken);
        } catch (_) {
          // Ignore server logout errors
        }
      }

      // Clear local data
      await _localDataSource.clearAuthData();
      _dioClient.resetAuthState();

      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.right(null);
    } catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.unauthenticated));
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, UserModel>> getCurrentUser() async {
    try {
      final accessToken = await _localDataSource.getAccessToken();
      if (accessToken == null) {
        return Either.left(const AuthFailure(
          message: 'Người dùng chưa đăng nhập',
          code: 'NOT_LOGGED_IN',
        ));
      }

      final user = await _remoteDataSource.getProfile(accessToken);

      // Update local cache
      await _localDataSource.saveUser(user);

      return Either.right(user);
    } on AuthException catch (e) {
      return Either.left(_mapAuthExceptionToFailure(e));
    } on NetworkException {
      // Try to return cached user if network fails
      final cachedUser = await _localDataSource.getUser();
      if (cachedUser != null) {
        return Either.right(cachedUser);
      }
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, UserModel>> updateProfile({
    String? fullName,
    String? phone,
    String? address,
    DateTime? dateOfBirth,
    String? gender,
  }) async {
    try {
      final accessToken = await _localDataSource.getAccessToken();
      if (accessToken == null) {
        return Either.left(const AuthFailure(
          message: 'Người dùng chưa đăng nhập',
          code: 'NOT_LOGGED_IN',
        ));
      }

      final user = await _remoteDataSource.updateProfile(
        accessToken: accessToken,
        fullName: fullName,
        phone: phone,
        address: address,
        dateOfBirth: dateOfBirth,
        gender: gender,
      );

      // Update local cache
      await _localDataSource.saveUser(user);

      return Either.right(user);
    } on AuthException catch (e) {
      return Either.left(_mapAuthExceptionToFailure(e));
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      final accessToken = await _localDataSource.getAccessToken();
      if (accessToken == null) {
        return Either.left(const AuthFailure(
          message: 'Người dùng chưa đăng nhập',
          code: 'NOT_LOGGED_IN',
        ));
      }

      await _remoteDataSource.changePassword(
        accessToken: accessToken,
        currentPassword: currentPassword,
        newPassword: newPassword,
      );

      return Either.right(null);
    } on AuthException catch (e) {
      return Either.left(_mapAuthExceptionToFailure(e));
    } on ValidationException catch (e) {
      return Either.left(ValidationFailure(
        message: e.message,
        code: e.code,
      ));
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> forgotPassword(String email) async {
    try {
      await _remoteDataSource.forgotPassword(email);
      return Either.right(null);
    } on ValidationException catch (e) {
      return Either.left(ValidationFailure(
        message: e.message,
        code: e.code,
      ));
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> resetPassword({
    required String resetToken,
    required String newPassword,
  }) async {
    try {
      await _remoteDataSource.resetPassword(
        resetToken: resetToken,
        newPassword: newPassword,
      );
      return Either.right(null);
    } on ValidationException catch (e) {
      return Either.left(ValidationFailure(
        message: e.message,
        code: e.code,
      ));
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, void>> resendVerificationEmail(String email) async {
    try {
      await _remoteDataSource.resendVerificationEmail(email);
      return Either.right(null);
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } on ServerException catch (e) {
      return Either.left(ServerFailure(
        message: e.message,
        code: e.code,
      ));
    } catch (e) {
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  @override
  Future<Either<Failure, TokenSet>> refreshSession() async {
    try {
      final refreshToken = await _localDataSource.getRefreshToken();
      if (refreshToken == null) {
        _emitAuthState(const AuthState(status: AuthStatus.expired));
        return Either.left(AuthFailure.sessionExpired());
      }

      final tokenSet = await _remoteDataSource.refreshToken(refreshToken);

      // Save new tokens
      await _localDataSource.saveTokens(
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        accessTokenExpiry: tokenSet.accessTokenExpiry,
        refreshTokenExpiry: tokenSet.refreshTokenExpiry,
      );

      _emitAuthState(const AuthState(status: AuthStatus.authenticated));
      return Either.right(tokenSet);
    } on AuthException {
      _emitAuthState(const AuthState(status: AuthStatus.expired));
      return Either.left(AuthFailure.sessionExpired());
    } on NetworkException {
      return Either.left(const NetworkFailure());
    } catch (e) {
      _emitAuthState(const AuthState(status: AuthStatus.expired));
      return Either.left(UnknownFailure(message: e.toString()));
    }
  }

  /// Save authentication data to local storage
  Future<void> _saveAuthData(TokenSet tokenSet, UserModel user) async {
    await Future.wait([
      _localDataSource.saveTokens(
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        accessTokenExpiry: tokenSet.accessTokenExpiry,
        refreshTokenExpiry: tokenSet.refreshTokenExpiry,
      ),
      _localDataSource.saveUser(user),
    ]);
  }

  /// Map AuthException to AuthFailure
  Failure _mapAuthExceptionToFailure(AuthException e) {
    switch (e.code) {
      case 'INVALID_CREDENTIALS':
        return AuthFailure.invalidCredentials();
      case 'SESSION_EXPIRED':
        return AuthFailure.sessionExpired();
      case 'USER_NOT_FOUND':
        return AuthFailure.userNotFound();
      case 'EMAIL_NOT_VERIFIED':
        return AuthFailure.emailNotVerified();
      case 'ACCOUNT_LOCKED':
        return AuthFailure.accountLocked();
      default:
        return AuthFailure(
          message: e.message,
          code: e.code,
        );
    }
  }

  /// Dispose stream controller
  void dispose() {
    _authStateController.close();
  }
}
