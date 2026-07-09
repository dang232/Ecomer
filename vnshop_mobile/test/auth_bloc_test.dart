import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:bloc_test/bloc_test.dart';
import 'package:vnshop_mobile/core/error/failures.dart';
import 'package:vnshop_mobile/features/auth/data/models/user_model.dart';
import 'package:vnshop_mobile/features/auth/data/models/token_set.dart';
import 'package:vnshop_mobile/features/auth/domain/repositories/auth_repository.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_bloc.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_event.dart';
import 'package:vnshop_mobile/features/auth/presentation/bloc/auth_state.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

class FakeAuthState extends Fake implements AuthState {}

void main() {
  late MockAuthRepository mockAuthRepository;

  const testUser = UserModel(
    id: 'user_1',
    email: 'test@example.com',
    fullName: 'Test User',
    phone: '0912345678',
  );

  final testTokenSet = TokenSet.withDefaults(
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
  );

  setUpAll(() {
    registerFallbackValue(FakeAuthState());
  });

  setUp(() {
    mockAuthRepository = MockAuthRepository();
  });

  group('AuthBloc', () {
    group('Login', () {
      blocTest<AuthBloc, AuthState>(
        'emits [loading, authenticated] when login with valid credentials succeeds',
        build: () {
          when(() => mockAuthRepository.login(
                email: any(named: 'email'),
                password: any(named: 'password'),
              )).thenAnswer((_) async => Either.right(testUser));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthLoginRequested(
          email: 'test@example.com',
          password: 'password123',
        )),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState.authenticated(user: testUser),
        ],
        verify: (_) {
          verify(() => mockAuthRepository.login(
                email: 'test@example.com',
                password: 'password123',
              )).called(1);
        },
      );

      blocTest<AuthBloc, AuthState>(
        'emits [loading, unauthenticated with error] when login with invalid credentials fails',
        build: () {
          when(() => mockAuthRepository.login(
                email: any(named: 'email'),
                password: any(named: 'password'),
              )).thenAnswer((_) async => Either.left(
                const AuthFailure(
                  message: 'Email hoặc mật khẩu không đúng',
                  code: 'INVALID_CREDENTIALS',
                ),
              ));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthLoginRequested(
          email: 'wrong@example.com',
          password: 'wrongpassword',
        )),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState(
            status: AuthStatus.unauthenticated,
            errorMessage: 'Email hoặc mật khẩu không đúng',
            errorCode: 'INVALID_CREDENTIALS',
          ),
        ],
      );
    });

    group('Logout', () {
      blocTest<AuthBloc, AuthState>(
        'emits [loading, unauthenticated] when logout succeeds',
        build: () {
          when(() => mockAuthRepository.logout())
              .thenAnswer((_) async => Either.right(null));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthLogoutRequested()),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState(status: AuthStatus.unauthenticated),
        ],
        verify: (_) {
          verify(() => mockAuthRepository.logout()).called(1);
        },
      );
    });

    group('Session Expired', () {
      blocTest<AuthBloc, AuthState>(
        'emits [expired] when session expired event is added',
        build: () {
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthSessionExpired()),
        expect: () => [
          const AuthState(status: AuthStatus.expired),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [expired] when refresh fails',
        build: () {
          when(() => mockAuthRepository.refreshSession())
              .thenAnswer((_) async => Either.left(
                    const AuthFailure(
                      message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
                      code: 'SESSION_EXPIRED',
                    ),
                  ));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        seed: () => const AuthState.authenticated(user: testUser),
        act: (bloc) => bloc.add(const AuthRefreshRequested()),
        expect: () => [
          const AuthState(
            status: AuthStatus.expired,
            user: testUser,
            errorMessage: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
          ),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits no change when refresh succeeds (user stays authenticated)',
        build: () {
          when(() => mockAuthRepository.refreshSession())
              .thenAnswer((_) async => Either.right(testTokenSet));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        seed: () => const AuthState.authenticated(user: testUser),
        act: (bloc) => bloc.add(const AuthRefreshRequested()),
        // On success, the bloc stays in authenticated state without emitting
        // because it just refreshes tokens, user stays logged in
        expect: () => [],
      );
    });

    group('401 Deduplication Pattern', () {
      test('demonstrates 401 handling pattern - refresh on concurrent failures',
          () async {
        // This test documents that the bloc doesn't currently have built-in
        // deduplication. For production, you'd want to add a mechanism to
        // deduplicate concurrent 401 errors. The test shows what happens
        // without deduplication - multiple refresh calls are made.
        var refreshCount = 0;

        when(() => mockAuthRepository.authStateChanges)
            .thenAnswer((_) => const Stream.empty());
        when(() => mockAuthRepository.refreshSession()).thenAnswer((_) async {
          refreshCount++;
          // Simulate network delay
          await Future.delayed(const Duration(milliseconds: 10));
          return Either.left(const AuthFailure(
            message: 'Phiên đăng nhập đã hết hạn',
            code: 'SESSION_EXPIRED',
          ));
        });

        final bloc = AuthBloc(authRepository: mockAuthRepository);

        // Simulate 5 concurrent 401 errors
        for (var i = 0; i < 5; i++) {
          bloc.add(const AuthRefreshRequested());
        }

        // Wait for all events to complete
        await Future.delayed(const Duration(milliseconds: 200));

        // Without deduplication, all 5 refresh calls are made
        // In production, you'd want to implement deduplication
        expect(refreshCount, 5);

        await bloc.close();
      });
    });

    group('AuthCheckRequested', () {
      blocTest<AuthBloc, AuthState>(
        'emits [loading, authenticated] when user is already logged in',
        build: () {
          when(() => mockAuthRepository.isLoggedIn())
              .thenAnswer((_) async => true);
          when(() => mockAuthRepository.getStoredUser())
              .thenAnswer((_) async => testUser);
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthCheckRequested()),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState.authenticated(user: testUser),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [loading, unauthenticated] when user is not logged in',
        build: () {
          when(() => mockAuthRepository.isLoggedIn())
              .thenAnswer((_) async => false);
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthCheckRequested()),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState(status: AuthStatus.unauthenticated),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [loading, authenticated] when fetch user from API succeeds after stored user is null',
        build: () {
          when(() => mockAuthRepository.isLoggedIn())
              .thenAnswer((_) async => true);
          when(() => mockAuthRepository.getStoredUser())
              .thenAnswer((_) async => null);
          when(() => mockAuthRepository.getCurrentUser())
              .thenAnswer((_) async => Either.right(testUser));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthCheckRequested()),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState.authenticated(user: testUser),
        ],
      );

      blocTest<AuthBloc, AuthState>(
        'emits [loading, unauthenticated] when getCurrentUser fails',
        build: () {
          when(() => mockAuthRepository.isLoggedIn())
              .thenAnswer((_) async => true);
          when(() => mockAuthRepository.getStoredUser())
              .thenAnswer((_) async => null);
          when(() => mockAuthRepository.getCurrentUser())
              .thenAnswer((_) async => Either.left(
                    const AuthFailure(
                      message: 'Failed to get user',
                      code: 'FETCH_ERROR',
                    ),
                  ));
          when(() => mockAuthRepository.authStateChanges)
              .thenAnswer((_) => const Stream.empty());
          return AuthBloc(authRepository: mockAuthRepository);
        },
        act: (bloc) => bloc.add(const AuthCheckRequested()),
        expect: () => [
          const AuthState(status: AuthStatus.loading),
          const AuthState(status: AuthStatus.unauthenticated),
        ],
      );
    });
  });
}
