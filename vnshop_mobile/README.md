# VNShop Mobile

A Flutter mobile application for the VNShop e-commerce platform. This app provides a seamless shopping experience on Android, iOS, and Web platforms.

## Project Description

VNShop Mobile is a cross-platform Flutter application that enables users to browse products, manage their cart, place orders, and track deliveries. The app integrates with Firebase for authentication and push notifications, and connects to the VNShop backend API for e-commerce functionality.

## Prerequisites

- **Flutter SDK**: 3.44.5
- **Dart SDK**: 3.12.2
- **Android Studio** (for Android development)
- **Xcode** (for iOS development, macOS only)
- **Firebase Project** (for authentication and notifications)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Full-Stack-Ecommerce/vnshop_mobile
```

### 2. Install Flutter Dependencies

```bash
flutter pub get
```

### 3. Configure Firebase

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Add Android and iOS apps to your Firebase project
3. Download the configuration files:
   - **Android**: `google-services.json` → place in `android/app/`
   - **iOS**: `GoogleService-Info.plist` → place in `ios/Runner/`

For CI/CD, base64 encode your configuration files and add them as GitHub Secrets:
- `STAGING_GOOGLE_SERVICES_JSON_B64` (for Android staging)
- `IOS_GOOGLE_SERVICES_B64` (for iOS staging)

```bash
# Encode for GitHub Secrets
base64 -i android/app/google-services.json
```

### 4. Environment Variables

The app uses the following environment configurations. Set these in your CI/CD pipeline or local development:

| Variable | Description | Required |
|----------|-------------|----------|
| `API_BASE_URL` | Backend API URL | Yes |
| `FIREBASE_API_KEY` | Firebase API Key | Yes |
| `FIREBASE_PROJECT_ID` | Firebase Project ID | Yes |
| `FIREBASE_APP_ID` | Firebase App ID | Yes |

## Available Scripts

### Development

```bash
# Install/update dependencies
flutter pub get

# Run static analysis
flutter analyze --no-fatal-infos --no-fatal-warnings

# Run unit and widget tests
flutter test

# Run tests with coverage report
flutter test --coverage --coverage-path=coverage/lcov.info
```

### Build Commands

```bash
# Build Android debug APK
flutter build apk --debug

# Build Android release APK
flutter build apk --release

# Build iOS (macOS only)
flutter build ios --release --no-codesign

# Build for Web
flutter build web
```

### Code Quality

```bash
# Format code
flutter format .

# Apply fixes
flutter fix --apply
```

## Project Structure

```
vnshop_mobile/
├── lib/
│   ├── main.dart              # App entry point
│   ├── config/                # App configuration
│   ├── models/                # Data models
│   ├── providers/             # State management (Provider/Riverpod)
│   ├── screens/               # UI screens
│   ├── services/              # API and external services
│   ├── widgets/               # Reusable UI components
│   └── utils/                 # Utility functions
├── test/                      # Unit and widget tests
├── android/                   # Android native configuration
├── ios/                       # iOS native configuration
└── web/                       # Web-specific assets
```

## CI/CD Pipeline

The project uses GitHub Actions for continuous integration and deployment. The workflow:

1. **Analyze**: Runs `flutter analyze` to check code quality
2. **Test**: Runs unit tests with coverage upload to Codecov
3. **Build Android**: Builds debug APK (skippable with `skip-android` in commit message)
4. **Build Web**: Builds web application
5. **Build iOS**: (Disabled) Requires macOS runner

### Skipping Android Build

To skip the Android build in CI, include `skip-android` in your commit message:

```bash
git commit -m "docs: update README skip-android"
```

## Contributing

1. Create a feature branch from `main`
2. Ensure all checks pass locally before pushing
3. Create a pull request with clear description
4. Request review from maintainers

## License

This project is proprietary software. All rights reserved.
