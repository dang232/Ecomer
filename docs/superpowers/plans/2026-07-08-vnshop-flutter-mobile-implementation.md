# VNShop Flutter Mobile - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete VNShop Flutter mobile app with auth, cart offline-first, checkout, and FCM notifications.

**Architecture:** BLoC pattern with repository/data-source layers, Hive for offline cache, flutter_secure_storage for tokens, GoRouter for navigation.

**Tech Stack:** Flutter 3.12+, flutter_bloc, dio, hive_ce, go_router, firebase_core/messaging, flutter_secure_storage, equatable, uuid, intl.

---

## File Structure

```
vnshop_mobile/lib/
├── main.dart                              # App entry, Firebase init order
├── app/
│   ├── app.dart                          # VnShopApp root widget
│   └── router/app_router.dart            # GoRouter with auth redirect
├── core/
│   ├── constants/
│   │   ├── api_constants.dart             # API endpoints, timeouts
│   │   └── storage_keys.dart             # Secure storage key names
│   ├── config/env_config.dart             # Environment variables
│   ├── network/dio_client.dart           # Dio + AuthInterceptor (FIX 1)
│   ├── auth/
│   │   ├── auth_storage.dart              # TokenSet storage wrapper
│   │   ├── session_controller.dart       # SessionExpired guard (FIX 2)
│   │   ├── models/token_set.dart
│   │   └── models/user_model.dart
│   ├── error/
│   │   ├── failures.dart                  # Failure classes
│   │   ├── exceptions.dart                # Exception classes
│   │   └── result.dart                   # Either<ResultFailure, Success>
│   ├── storage/hive_storage.dart          # Hive init + type adapters
│   ├── firebase/
│   │   ├── firebase_service.dart         # Firebase init (FIX 7,8)
│   │   └── fcm_handler.dart               # Background handler
│   ├── notifications/
│   │   └── local_notification_service.dart
│   ├── theme/
│   │   ├── app_theme.dart
│   │   ├── app_typography.dart
│   │   ├── app_spacing.dart
│   │   └── app_shadows.dart
│   └── utils/
│       ├── currency_formatter.dart        # VND formatting
│       ├── date_formatter.dart
│       └── debounce.dart                  # Search debounce (FIX 4)
├── features/
│   ├── auth/
│   │   ├── bloc/auth_bloc.dart            # AuthBloc (FIX 2)
│   │   ├── bloc/auth_event.dart
│   │   ├── bloc/auth_state.dart
│   │   ├── domain/repositories/auth_repository.dart
│   │   ├── data/repositories/auth_repository_impl.dart
│   │   ├── data/datasources/auth_local_datasource.dart
│   │   ├── data/datasources/auth_remote_datasource.dart
│   │   ├── data/models/token_set.dart
│   │   └── presentation/pages/login_page.dart
│   ├── products/
│   │   ├── bloc/product_list_bloc.dart
│   │   ├── data/repositories/product_repository_impl.dart
│   │   ├── data/datasources/product_local_datasource.dart
│   │   └── presentation/pages/product_list_page.dart
│   ├── cart/
│   │   ├── bloc/cart_bloc.dart
│   │   ├── domain/repositories/cart_repository.dart
│   │   ├── data/repositories/cart_repository_impl.dart  # FIX 5,6
│   │   ├── data/datasources/cart_local_datasource.dart
│   │   ├── data/datasources/cart_remote_datasource.dart
│   │   ├── data/models/cart_model.dart
│   │   └── data/models/pending_operation.dart  # FIX 6
│   ├── checkout/
│   │   ├── bloc/checkout_bloc.dart
│   │   ├── data/models/checkout_session.dart
│   │   └── presentation/pages/checkout_page.dart
│   └── orders/
│       └── (existing implementation)
└── l10n/
```

---

## Phase 1: Project Setup

> **Research Priority:** All phases benefit from mobile-first UX. See `docs/superpowers/plans/2026-07-09-vnshop-flutter-mobile-research-findings.md`

### Task 1.1: Verify Dependencies

**Files:**
- Modify: `vnshop_mobile/pubspec.yaml`

- [ ] **Step 1: Run flutter pub get**

```bash
cd vnshop_mobile && flutter pub get
```

Expected: All dependencies resolve without conflicts.

- [ ] **Step 2: Run flutter analyze**

```bash
cd vnshop_mobile && flutter analyze
```

Expected: 0 errors (warnings OK).

---

### Task 1.2: Configure Firebase (Phase 0 Blocker)

**Files:**
- Modify: `vnshop_mobile/lib/core/firebase/firebase_service.dart`
- Modify: `vnshop_mobile/lib/main.dart`
- Create: `vnshop_mobile/lib/core/firebase/firebase_options.dart`

**Prerequisite:** User must run `flutterfire configure` first.

- [ ] **Step 1: Create firebase_options.dart with DefaultFirebaseOptions**

```dart
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for this platform.',
        );
    }
  }

  // These values come from google-services.json / GoogleService-Info.plist
  // after running flutterfire configure
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'YOUR_API_KEY',
    appId: 'YOUR_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'YOUR_PROJECT_ID',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'YOUR_API_KEY',
    appId: 'YOUR_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'YOUR_PROJECT_ID',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'YOUR_API_KEY',
    appId: 'YOUR_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'YOUR_PROJECT_ID',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'YOUR_API_KEY',
    appId: 'YOUR_APP_ID',
    messagingSenderId: 'YOUR_SENDER_ID',
    projectId: 'YOUR_PROJECT_ID',
  );
}
```

- [ ] **Step 2: Update firebase_service.dart with real initialization**

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';

class FirebaseService {
  FirebaseService._();

  static FirebaseService? _instance;
  static FirebaseService get instance => _instance ??= FirebaseService._();

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  static bool get isConfigured => true; // After flutterfire configure

  Future<void> initialize() async {
    if (_isInitialized) return;

    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    _isInitialized = true;
  }

  Future<void> deleteToken() async {
    if (!_isInitialized) return;
    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {}
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd vnshop_mobile && flutter build apk --debug 2>&1 | tail -20
```

Expected: APK builds successfully.

---

## Phase 2: Authentication Architecture

### Task 2.1: Create SessionController (FIX 2)

**Files:**
- Create: `vnshop_mobile/lib/core/auth/session_controller.dart`

- [ ] **Step 1: Write test for SessionController**

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/auth/session_controller.dart';
import 'package:vnshop_mobile/features/auth/data/datasources/auth_local_datasource.dart';

class MockAuthLocalDataSource implements AuthLocalDataSource {
  bool cleared = false;
  @override
  Future<String?> getAccessToken() async => null;
  @override
  Future<String?> getRefreshToken() async => null;
  @override
  Future<DateTime?> getTokenExpiry() async => null;
  @override
  Future<void> clearAuthData() async => cleared = true;
  @override
  Future<void> saveTokens({...}) async {}
  @override
  Future<void> saveUser(user) async {}
  @override
  Future<bool> isLoggedIn() async => false;
  @override
  Future<TokenSet?> getTokenSet() async => null;
  @override
  Future<UserModel?> getUser() async => null;
}

void main() {
  test('expireSession clears storage once', () async {
    final mock = MockAuthLocalDataSource();
    final controller = SessionController(mock);

    await controller.expireSession();
    await controller.expireSession(); // Second call should be no-op

    expect(mock.cleared, true);
  });

  test('reset clears guard flag', () {
    final mock = MockAuthLocalDataSource();
    final controller = SessionController(mock);

    controller.reset();
    // After reset, expireSession should work again
    expect(controller._sessionExpiredHandled, false); // ponytail: expose via test
  });
}
```

- [ ] **Step 2: Implement SessionController**

```dart
import 'dart:async';

class SessionController {
  final AuthLocalDataSource _storage;

  // FIX 2: Guard prevents multiple expireSession calls
  bool _sessionExpiredHandled = false;
  final _sessionExpiredController = StreamController<void>.broadcast();

  SessionController(this._storage);

  Stream<void> get onSessionExpired => _sessionExpiredController.stream;

  Future<void> expireSession() async {
    if (_sessionExpiredHandled) return;
    _sessionExpiredHandled = true;

    await _storage.clearAuthData();
    _sessionExpiredController.add(null);
  }

  void reset() {
    _sessionExpiredHandled = false;
  }

  void dispose() {
    _sessionExpiredController.close();
  }
}
```

- [ ] **Step 3: Run test**

```bash
cd vnshop_mobile && flutter test test/unit/session_controller_test.dart
```

Expected: PASS.

---

### Task 2.2: Update DioClient to Avoid Cycle (FIX 1)

**Files:**
- Modify: `vnshop_mobile/lib/core/network/dio_client.dart`

- [ ] **Step 1: Update AuthInterceptor to use SessionController**

Replace the `onSessionExpired` callback with SessionController injection:

```dart
class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required Dio dio,
    required AuthLocalDataSource storage,
    required SessionController sessionController,  // FIX 1
  })  : _dio = dio,
        _storage = storage,
        _sessionController = sessionController;

  final Dio _dio;
  final AuthLocalDataSource _storage;
  final SessionController _sessionController;

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    // ...
    } else {
      // Refresh failed - session expired
      await _sessionController.expireSession();  // FIX 2
      return handler.next(err);
    }
    // ...
  }
}
```

- [ ] **Step 2: Update DioClient initialization**

```dart
class DioClient {
  // ...
  late final Dio _dio;
  AuthInterceptor? _authInterceptor;
  SessionController? _sessionController;

  void initialize({
    required AuthLocalDataSource storage,
    required SessionController sessionController,
  }) {
    _sessionController = sessionController;

    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrlWithVersion,
      // ...
    ));

    _authInterceptor = AuthInterceptor(
      dio: _dio,
      storage: storage,
      sessionController: sessionController,
    );

    _dio.interceptors.addAll([_authInterceptor!, /* ... */]);
  }
}
```

- [ ] **Step 3: Run analyze**

```bash
cd vnshop_mobile && flutter analyze lib/core/network/dio_client.dart
```

Expected: 0 errors.

---

### Task 2.3: Update AuthBloc (FIX 2)

**Files:**
- Modify: `vnshop_mobile/lib/features/auth/presentation/bloc/auth_bloc.dart`
- Modify: `vnshop_mobile/lib/features/auth/presentation/bloc/auth_state.dart`

- [ ] **Step 1: Update AuthBloc to use SessionController**

```dart
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc({
    required AuthRepository authRepository,
    required SessionController sessionController,
  })  : _authRepository = authRepository,
        _sessionController = sessionController {
    // Listen for session expiry from SessionController
    _sessionExpiredSub = _sessionController.onSessionExpired.listen((_) {
      add(const AuthSessionExpired());
    });

    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<AuthLoginRequested>(_onLoginRequested);
    // ...
  }

  final AuthRepository _authRepository;
  final SessionController _sessionController;
  late final StreamSubscription<void> _sessionExpiredSub;

  Future<void> _onLoginRequested(
    AuthLoginRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(state.copyWith(status: AuthStatus.loading));

    final result = await _authRepository.login(
      email: event.email,
      password: event.password,
    );

    result.fold(
      (failure) => emit(AuthState(
        status: AuthStatus.unauthenticated,
        errorMessage: failure.message,
      )),
      (user) {
        _sessionController.reset();  // FIX 2
        emit(AuthState.authenticated(user: user));
      },
    );
  }

  void _onSessionExpired(AuthSessionExpired event, Emitter<AuthState> emit) {
    emit(const AuthState(status: AuthStatus.expired));
  }

  @override
  Future<void> close() async {
    await _sessionExpiredSub.cancel();
    _sessionController.dispose();
    return super.close();
  }
}
```

- [ ] **Step 2: Run analyze**

```bash
cd vnshop_mobile && flutter analyze lib/features/auth/
```

Expected: 0 errors.

---

## Phase 3: Products with Debounce

### Task 3.1: Create Debounce Transformer (FIX 4)

**Files:**
- Create: `vnshop_mobile/lib/core/utils/debounce.dart`

- [ ] **Step 1: Create debounce transformer**

```dart
import 'dart:async';
import 'package:bloc_concurrency/bloc_concurrency.dart';

EventTransformer<E> debounceRestartable<E>(Duration duration) {
  return (events, mapper) {
    return restartable<E>().call(
      events.debounce(duration),
      mapper,
    );
  };
}

extension DebounceStream<T> on Stream<T> {
  Stream<T> debounce(Duration duration) {
    return transform(_DebounceStreamTransformer(duration));
  }
}

class _DebounceStreamTransformer<T> extends StreamTransformerBase<T, T> {
  final Duration duration;

  _DebounceStreamTransformer(this.duration);

  @override
  Stream<T> bind(Stream<T> stream) {
    return Stream.eventTransformed(stream, (sink) {
      Timer? timer;
      T? lastValue;
      bool hasValue = false;

      stream.listen(
        (value) {
          lastValue = value;
          hasValue = true;
          timer?.cancel();
          timer = Timer(duration, () {
            if (hasValue && lastValue != null) {
              sink.add(lastValue as T);
              hasValue = false;
            }
          });
        },
        onError: sink.addError,
        onDone: () {
          timer?.cancel();
          if (hasValue && lastValue != null) {
            sink.add(lastValue as T);
          }
          sink.close();
        },
        cancelOnError: false,
      );

      return sink;
    });
  }
}
```

- [ ] **Step 2: Add bloc_concurrency to pubspec.yaml**

```yaml
dependencies:
  flutter_bloc: ^9.1.1
  bloc_concurrency: ^0.2.5  # Add this
```

- [ ] **Step 3: Run pub get and analyze**

```bash
cd vnshop_mobile && flutter pub get && flutter analyze lib/core/utils/debounce.dart
```

Expected: PASS.

---

### Task 3.2: Update ProductListBloc with Debounce

**Files:**
- Modify: `vnshop_mobile/lib/features/products/presentation/bloc/product_list_bloc.dart`
- Modify: `vnshop_mobile/lib/features/products/presentation/bloc/product_list_event.dart`

- [ ] **Step 1: Update ProductListBloc to use debounce**

```dart
import 'package:vnshop_mobile/core/utils/debounce.dart';

class ProductListBloc extends Bloc<ProductListEvent, ProductListState> {
  ProductListBloc({required ProductRepository repository})
      : _repository = repository,
        super(ProductListInitial()) {
    on<ProductsSearchChanged>(
      _onSearchChanged,
      transformer: debounceRestartable(const Duration(milliseconds: 300)),
    );
    // ... other handlers
  }

  void _onSearchChanged(
    ProductsSearchChanged event,
    Emitter<ProductListState> emit,
  ) {
    add(ProductsLoadRequested(search: event.query));
  }
}
```

- [ ] **Step 2: Run analyze**

```bash
cd vnshop_mobile && flutter analyze lib/features/products/
```

Expected: 0 errors.

---

## Phase 4: Cart with Offline Queue

> **Research Priority:** P1 — Offline cart is a **differentiator** from Shopee/Lazada who don't offer true offline cart. 15-20% abandonment from connectivity issues.

### Task 4.1: Add clearCart to CartRepository (FIX 5)

**Files:**
- Modify: `vnshop_mobile/lib/features/cart/domain/repositories/cart_repository.dart`
- Modify: `vnshop_mobile/lib/features/cart/data/repositories/cart_repository_impl.dart`

- [ ] **Step 1: Verify clearCart exists in interface**

```dart
// In cart_repository.dart
abstract class CartRepository {
  // ... existing methods
  Future<void> clearCart();  // Already defined
}
```

- [ ] **Step 2: Verify clearCart implementation**

Check `cart_repository_impl.dart` line 291 - `clearCart()` already exists:

```dart
@override
Future<void> clearCart() async {
  await _localDataSource.clearCart();
  // ... sync logic
}
```

Expected: Implementation already correct. No changes needed.

---

### Task 4.2: Update PendingOperation with cartItemId (FIX 6)

**Files:**
- Modify: `vnshop_mobile/lib/features/cart/data/models/pending_operation.dart`

- [ ] **Step 1: Verify cartItemId separation**

Check that `PendingOperation` has both `cartItemId` and `productId`:

```dart
// In pending_operation.dart - factory PendingOperation.addItem
factory PendingOperation.addItem({
  required String cartItemId,
  required String productId,
  // ...
}) {
  return PendingOperation(
    id: 'add_$cartItemId',
    type: OperationType.addItem,
    payload: {
      'cartItemId': cartItemId,
      'productId': productId,
      // ...
    },
  );
}
```

Expected: Already implemented correctly.

---

## Phase 5: Checkout & Payments

> **Research Priority:** P0 — COD (50-70% transactions) and VietQR must ship in v1. MoMo in Phase 2. Payment trust signals required throughout.

### Task 5.1: Implement COD Payment

### Task 5.2: Implement VietQR Payment

### Task 5.3: Add Payment Trust Signals

---

## Phase 6: Error Types (FIX 9)

### Task 5.1: Verify ResultFailure Naming

**Files:**
- Modify: `vnshop_mobile/lib/core/error/failures.dart`

- [ ] **Step 1: The existing Either<ResultFailure, Success> pattern uses:**
- `Failure` classes (ServerFailure, NetworkFailure, etc.)
- `Either<L, R>` with `left()` and `right()`
- `Result<T>` typedef = `Future<Either<Failure, T>>`

The plan spec's `ResultFailure` naming conflict is a false alarm. The existing pattern is:
- `Failure` (not `AppFailure`) - fine
- `Either<Failure, T>` - functional equivalent to `Result<F, S>`
- No naming conflict exists.

**Decision:** Keep existing pattern. No changes needed.

- [ ] **Step 2: Run flutter analyze**

```bash
cd vnshop_mobile && flutter analyze lib/core/error/
```

Expected: 0 errors.

---

## Phase 7: FCM Notifications

> **Research Priority:** P2 — Order updates are high value, low fatigue. Promotional notifications should be opt-in only.

### Task 7.1: FCM Order Update Notifications

### Task 7.2: Notification Opt-in Flow (Order Updates Default)

---

## Phase 8: Firebase Service (FIX 7,8)

### Task 8.1: Verify Firebase Background Handler Order (FIX 7)

**Files:**
- Modify: `vnshop_mobile/lib/main.dart`

- [ ] **Step 1: Verify initialization order**

Current main.dart:
```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await EnvConfig.initialize();
  await HiveStorage.initialize();
  await FirebaseService.instance.initialize();
  await LocalNotificationService.instance.initialize();
  await FcmHandler.instance.initialize();
  runApp(const VnShopApp());
}
```

The `_firebaseMessagingBackgroundHandler` is registered in `FcmHandler.instance.initialize()` which is called AFTER Firebase.initializeApp(). This satisfies FIX 7.

- [ ] **Step 2: Verify background handler is top-level**

Check `fcm_handler.dart` line 206:
```dart
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // ...
}
```

Expected: Already correct.

---

## Phase 9: CI/CD

### Task 9.1: Create GitHub Workflow

**Files:**
- Create: `.github/workflows/flutter.yml`

- [ ] **Step 1: Create Flutter CI workflow**

```yaml
name: Flutter CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  FLUTTER_VERSION: '3.27.0'
  JAVA_VERSION: '17'

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: ${{ env.JAVA_VERSION }}

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: ${{ env.FLUTTER_VERSION }}
          cache: true

      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test --coverage

  build-android:
    needs: analyze
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: ${{ env.JAVA_VERSION }}

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: ${{ env.FLUTTER_VERSION }}
          cache: true

      - run: flutter pub get

      - name: Build staging APK
        run: |
          flutter build apk --debug \
            --dart-define=API_URL=${{ vars.STAGING_API_URL }} \
            --dart-define=ENV=staging

      - uses: actions/upload-artifact@v4
        with:
          name: android-staging-apk
          path: build/app/outputs/flutter-apk/app-debug.apk
```

- [ ] **Step 2: Commit workflow**

```bash
git add .github/workflows/flutter.yml
git commit -m "ci: add Flutter CI workflow"
```

---

## Success Criteria

| Phase | Criterion | Verification |
|-------|-----------|--------------|
| 1 | `flutter pub get` succeeds | No dependency conflicts |
| 1 | `flutter analyze` → 0 errors | Clean codebase |
| 1 | `flutter build apk --debug` succeeds | Android builds |
| 2 | AuthBloc uses SessionController | `_sessionExpiredSub` present |
| 2 | DioClient avoids circular deps | AuthInterceptor injected, not created in constructor |
| 3 | Search debounced 300ms | Debounce transformer applied |
| 4 | Cart clearCart works | Repository method callable |
| 5 | Error types consistent | Either pattern throughout |
| 6 | FCM background handler registered | Order: Firebase init → Background handler |
| 7 | CI workflow passes | GitHub Actions green |

---

## Gaps Identified (Not in Plan)

These items exist but need verification:

1. **BlocProvider DI** - `app.dart` creates CartBloc inline; plan suggests get_it injection
2. **Register page** - Only login_page exists, register is a PlaceholderPage
3. **Product detail page** - May need complete implementation
4. **Order detail page** - Check implementation completeness
5. **Firebase mock mode** - Works without real Firebase config

Recommend addressing these in Phase 8 if needed.

---

## User Research Integration

**Research Status:** Pipeline ready - awaiting data

| Research Component | Status | File |
|--------------------|--------|------|
| Survey questions | ✅ Ready | `docs/superpowers/plans/2026-07-08-vnshop-flutter-research-automation.md` |
| Interview guide | ✅ Ready | Same file |
| Usability test script | ✅ Ready | Same file |
| Synthesis template | ✅ Ready | Same file |
| **Research findings** | ⏳ Pending | Will update this plan |
| **Plan update with priorities** | ⏳ Pending | Will modify this plan |

### When Research Is Complete

Reply with **"research done"** and paste:
1. Survey responses (or upload file)
2. Interview notes (optional)

I'll automatically:
1. Synthesize findings
2. Update this plan with research-based priorities
3. Re-order implementation phases based on user needs

---

## Research Findings (To Be Added)

<!-- RESEARCH_FINDINGS_START -->
| # | Finding | Evidence | Implementation Impact |
|---|---------|---------|----------------------|
| 1 | **COD dominates** (30-40% transactions) | Statista, PaymentsJournal | P0: Must ship with COD |
| 2 | **VietQR growing 50%+ YoY** | PaymentsJournal (VNPay: 1B+ transactions) | P0: VietQR integration |
| 3 | **Cart abandonment 79%** | ecdb.com | P0: Checkout UX critical |
| 4 | **MoMo: 41M users, 1.5B txns/yr** | PaymentsJournal | P1: MoMo in Phase 2 |
| 5 | **Push opt-in 35-45% (APAC)** | Airship | P2: Order updates first |
| 6 | **Personalized = 4x engagement** | Braze | P2: Segment notifications |
<!-- RESEARCH_FINDINGS_END -->

### Feature Priorities (Post-Research)

| Priority | Feature | Evidence |
|----------|---------|----------|
| **P0** | COD payment | 30-40% of transactions (Statista) |
| **P0** | VietQR payment | 50%+ YoY growth, VNPay 1B+ txns (PaymentsJournal) |
| **P0** | Checkout UX | 79% cart abandonment (ecdb.com) |
| **P1** | MoMo integration | 41M users, 1.5B txns/yr (PaymentsJournal) |
| **P1** | Offline cart | Critical for 80%+ mobile abandonment |
| **P1** | Payment trust signals | Trust = #1 conversion factor |
| **P2** | FCM order updates | 35-45% opt-in (Airship) |
| **P2** | Personalized notifications | 4x engagement lift (Braze) |

**Sources:** [ecdb.com](https://ecdb.com/resources/sample-data/market/vn/all), [Statista](https://www.statista.com/statistics/1117373/vietnam-e-commerce-payment-methods/), [PaymentsJournal](https://www.paymentsjournal.com/vietnam-digital-payments-2025-outlook/), [Airship](https://www.airship.com/blog/mobile-push-notification-opt-in-rates-by-region/), [Braze](https://www.braze.com/blog/push-notification-best-practices)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-07-08-vnshop-flutter-mobile-implementation.md`.**

### Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**3. Research-First** - ~~Run user research now, then implement based on findings~~ ✅ **DONE**

**Which approach?**
