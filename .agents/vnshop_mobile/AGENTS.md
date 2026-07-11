<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# VNShop Mobile App (vnshop_mobile/)

## Purpose
Flutter mobile application for the Vietnamese market. Connects to the VNShop API gateway, supports VietQR/MoMo payments, OneSignal push notifications, and Vietnamese/English localization.

## Key Files
| File | Description |
|------|-------------|
| `pubspec.yaml` | Flutter dependencies and SDK constraint (`^3.12.2`, builds with 3.44) |
| `l10n.yaml` | Localization config (Vietnamese + English) |
| `lib/main.dart` | App entry point |
| `lib/app/app.dart` | App shell with router and providers |
| `lib/app/router/` | GoRouter configuration |
| `lib/app/shell/` | App shell scaffold with bottom nav |
| `pubspec.lock` | Locked dependency versions |
| `test/` | Unit and widget tests |
| `DESIGN_REQUIREMENTS.md` | UI/UX design specs |
| `QA_EVIDENCE.md` | Test coverage evidence |
| `README.md` | Setup and payment integration docs |

## Tech Stack
- **Flutter 3.44** (SDK constraint `^3.12.2`)
- **BLoC** for state management (`flutter_bloc ^9.1.1`)
- **Dio** for HTTP (`^5.10.0`)
- **GoRouter** for navigation (`^17.3.0`)
- **Hive CE** for local storage (`^2.19.3`)
- **OneSignal** for push notifications (`^5.1.2`)
- **Flutter Secure Storage** for tokens (`^10.3.1`)
- **Freezed** + **json_serializable** for immutable models
- **Equatable** for value equality
- **i18n** via `flutter_localizations`

## App Structure
```
lib/
├── app/              # App shell, router, theme
├── features/         # Feature modules (auth, cart, checkout, home, orders, products, profile)
├── core/             # Shared: auth, config, constants, error, network, notifications, storage, theme, utils
├── common/           # Shared UI components
└── l10n/             # Localization strings (auto-generated)
```

## For AI Agents

### Working In This Directory
- Run `flutter pub get` after modifying `pubspec.yaml`
- Run `flutter gen-l10n` after modifying `lib/l10n/`
- API base URL: `http://10.0.2.2:8080` (Android emulator host) or `http://localhost:8080` (iOS simulator)
- Auth tokens stored in `flutter_secure_storage` (NOT shared_preferences)
- Guest cart stored in Hive CE under `vnshop:guest-cart`

### Testing
```bash
cd vnshop_mobile
flutter test                    # Unit + widget tests
flutter test --coverage        # With coverage report
flutter analyze               # Static analysis
```

### Build
```bash
flutter build apk --release    # Android
flutter build ios --release    # iOS
```

### CI
GitHub Actions pipeline at `.github/workflows/flutter.yml`:
- Runs `flutter test` and `flutter analyze`
- Builds for Android (APK)
- Uploads coverage to Codecov

## Feature Modules
| Feature | Description |
|---------|-------------|
| `auth/` | Login, register, token management, secure storage |
| `cart/` | Guest/authenticated cart via cart-service |
| `checkout/` | Order placement, coupon apply, payment selection |
| `home/` | Home feed, search, categories, product grid |
| `orders/` | Order list, detail, tracking, cancellation |
| `products/` | Product detail, images, reviews, variants, search |
| `profile/` | User profile, addresses, settings, language toggle |

## Core Modules
| Module | Purpose |
|--------|---------|
| `core/auth/` | Dio interceptors for JWT, refresh token logic |
| `core/config/` | Environment config, API base URL |
| `core/network/` | Dio client, interceptors, error handling |
| `core/notifications/` | OneSignal initialization, foreground/background handlers |
| `core/storage/` | Hive CE boxes, secure storage wrapper |
| `core/theme/` | Material 3 theme, color scheme, typography |

## Dependencies

### Internal
- `fe/` — shares payment/push notification patterns
- `services/cart-service/` — cart REST API
- `services/order-service/` — order placement API
- `services/payment-service/` — payment intent API

### External
- OneSignal — push notification delivery
- VietQR / MoMo — payment QR codes
- MinIO (via API) — image CDN

## Ports
Mobile app connects to `localhost:8080` (gateway). No mobile-specific service ports — all traffic goes through the gateway.

<!-- MANUAL: -->
