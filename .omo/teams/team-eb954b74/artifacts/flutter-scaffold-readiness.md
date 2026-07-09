# Flutter Scaffold Readiness

Member: B - `flutter-scaffold-readiness`
Thread: `019f3db5-e1c5-7c70-890b-844987ca3a3d`
Scope: Phase 1 Flutter mobile project setup under `vnshop_mobile`
Checked: 2026-07-08

## Result

Blocked. Flutter tooling is not usable in this checkout, so I did not create
`vnshop_mobile`. The requested scaffold, dependencies, router stub, Hive
initialization, `flutter pub get`, `flutter analyze`, and Android debug build
gate all depend on a working Flutter SDK.

## Evidence

Repository state:

```text
vnshop_mobile missing
find . -maxdepth 3 -name pubspec.yaml -print
# no output
```

Git Bash tooling checks from repository root:

```text
command -v flutter
# no output

flutter --version
/usr/bin/bash: line 5: flutter: command not found

command -v dart
# no output

dart --version
/usr/bin/bash: line 6: dart: command not found
```

Common Flutter SDK locations checked:

```text
/c/flutter
/c/src/flutter
$HOME/flutter
$HOME/scoop/apps/flutter/current
$LOCALAPPDATA/Pub/Cache/bin
# none existed
```

PowerShell tooling checks from repository root:

```text
Get-Command flutter -ErrorAction SilentlyContinue
# no output

Get-Command dart -ErrorAction SilentlyContinue
# no output

where.exe flutter
INFO: Could not find files for the given pattern(s).

where.exe dart
INFO: Could not find files for the given pattern(s).
```

Android build prerequisites:

```text
ANDROID_HOME=
ANDROID_SDK_ROOT=
JAVA_HOME=C:\Users\dangq\AppData\Local\Programs\Temurin-25\jdk-25.0.3+9
```

Git Bash could resolve Java only through the Oracle Java 8 shim:

```text
/c/Program Files (x86)/Common Files/Oracle/Java/javapath/java
java version "1.8.0_401"
```

PowerShell did not resolve `adb` or `sdkmanager`, and no Android SDK
environment variable was set. Even after Flutter is installed, Android debug
build readiness still needs Android SDK command-line tools and `flutter doctor`
validation.

## Smallest Next Action

Install Flutter SDK on this Windows host, add its `bin` directory to PATH for
both PowerShell and Git Bash, then open a new shell and run:

```bash
flutter --version
flutter doctor -v
```

If `flutter doctor -v` reports missing Android tooling, install Android Studio
or Android SDK command-line tools, set `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and
accept Android licenses:

```bash
flutter doctor --android-licenses
flutter doctor -v
```

Once those checks pass, create the Phase 1 project from the repository root:

```bash
flutter create --org com.vnshop --project-name vnshop_mobile vnshop_mobile
cd vnshop_mobile
flutter pub add go_router flutter_riverpod dio hive hive_flutter path_provider json_annotation freezed_annotation
flutter pub add --dev build_runner json_serializable freezed hive_generator flutter_lints
flutter pub get
flutter analyze
flutter build apk --debug
```

## Scaffold Notes For The Next Pass

- Initialize Hive before `runApp`, using `hive_flutter`.
- Add a minimal `go_router` router stub early so feature screens can attach
  routes without replacing app bootstrap.
- Fix the Android `applicationId`/package identity before running
  `flutterfire configure`; Firebase readiness expects a stable value, likely
  `com.vnshop.mobile` unless the leader chooses another package name.
- Model checkout idempotency as a required `Idempotency-Key` request header for
  `POST /orders`, not as a JSON body field. This came from the backend contract
  audit lane and should be reflected in the future Flutter API client.
- Use `.omo/teams/team-eb954b74/artifacts/backend-contract-audit.md` as the
  source for current order/payment API shape. It confirms the backend exposes
  singular `/payment/**` routes, including method-specific create flows and
  `GET /payment/status/{orderId}`, not the Flutter-plan endpoints
  `POST /payments/initiate` or `GET /payments/{transactionId}/status`.
