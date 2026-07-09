# Firebase Platform Readiness

Member C: `firebase-platform-readiness`  
Team: `vnshop-flutter`  
Artifact: `.omo/teams/team-eb954b74/artifacts/firebase-platform-readiness.md`

## Result

Firebase/mobile platform setup is not ready yet.

Current conclusion:

- No local Flutter/Dart/Firebase/FlutterFire CLI is available.
- No `vnshop_mobile/` app or Firebase generated config files exist in the repo.
- Current CI is backend/web only.
- `.gitignore` does not yet include mobile generated secret/config patterns.
- `notification-service` has an FCM adapter, but it requires `FIREBASE_SERVICE_ACCOUNT`.
- Push delivery also requires a recipient device token; mobile token registration remains a Phase 5 prerequisite.

## Local CLI evidence

Checked from repository root:

| Command/check | Result |
| --- | --- |
| `command -v flutter` | not found |
| `command -v dart` | not found |
| `command -v firebase` | not found |
| `command -v flutterfire` | not found |
| `where.exe flutter` | not found |
| `where.exe dart` | not found |
| `where.exe firebase` | not found |
| `where.exe flutterfire` | not found |

Blocker:

- Cannot run `flutterfire configure`, `flutter pub get`, `flutter analyze`, or an Android build gate on this machine until Flutter SDK, Dart, Firebase CLI, and FlutterFire CLI are installed and on PATH.

## Repo/mobile config evidence

Repo scan found none of the expected mobile/Firebase platform files:

| Expected path/file | Result |
| --- | --- |
| `vnshop_mobile/` | absent |
| Flutter `pubspec.yaml` under mobile app | absent |
| `vnshop_mobile/android/` | absent |
| `AndroidManifest.xml` | absent |
| Android Gradle `applicationId` | absent |
| `lib/firebase_options.dart` | absent |
| `android/app/google-services.json` | absent |
| `ios/Runner/GoogleService-Info.plist` | absent |

Package identity dependency:

- Android package/application id should be fixed before `flutterfire configure`.
- Recommended default unless leader decides otherwise: `com.vnshop.mobile`.

Expected setup commands after the mobile scaffold exists:

```bash
cd vnshop_mobile
flutter pub add firebase_core firebase_messaging
flutterfire configure \
  --project "$FIREBASE_PROJECT_ID" \
  --platforms=android \
  --android-package-name com.vnshop.mobile \
  --out=lib/firebase_options.dart
```

Generated-file expectations:

- `vnshop_mobile/lib/firebase_options.dart`
- Possibly `vnshop_mobile/firebase.json`
- Android Firebase config if native Firebase/Gradle integration is needed: `vnshop_mobile/android/app/google-services.json`
- iOS Firebase config if iOS is in scope: `vnshop_mobile/ios/Runner/GoogleService-Info.plist`

## CI/.gitignore evidence

Existing GitHub workflows:

- `.github/workflows/ci.yml`: Java services, Node services, Docker scan, proto check, coverage summary.
- `.github/workflows/cd.yml`: backend service image build/push and Kubernetes manifest update.
- `.github/workflows/lint-fe.yml`: React frontend lint checks.
- `.github/workflows/verify-backup.yml`: backup verification.

No workflow currently sets up Flutter/Dart, runs `flutterfire`, builds Android, or references Firebase/mobile secrets.

Current `.gitignore` covers root env files, FE env/build output, service build output, Kafka certs, Terraform state, and tool caches. It does not yet cover mobile-local generated secret/build patterns such as:

```gitignore
/vnshop_mobile/build/
/vnshop_mobile/.dart_tool/
/vnshop_mobile/android/key.properties
/vnshop_mobile/android/app/*.jks
/vnshop_mobile/android/app/*.keystore
/vnshop_mobile/**/firebase-service-account*.json
```

Required CI names to add when the mobile app lands:

Variables:

```text
FIREBASE_PROJECT_ID
FIREBASE_ANDROID_PACKAGE_NAME
FLUTTER_VERSION
```

Secrets:

```text
FIREBASE_CI_SERVICE_ACCOUNT_JSON
FIREBASE_SERVICE_ACCOUNT
ANDROID_UPLOAD_KEYSTORE_BASE64
ANDROID_UPLOAD_KEYSTORE_PASSWORD
ANDROID_UPLOAD_KEY_ALIAS
ANDROID_UPLOAD_KEY_PASSWORD
```

## Backend FCM evidence

Existing backend support:

- `services/notification-service/package.json` includes `firebase-admin`.
- `services/notification-service/src/notification/infrastructure/push/fcm-push-channel.adapter.ts` implements Firebase Cloud Messaging push delivery.
- The adapter expects `FIREBASE_SERVICE_ACCOUNT` as a JSON-encoded service account credential.
- Without `FIREBASE_SERVICE_ACCOUNT`, the adapter stays in stub mode and does not send real pushes.
- `services/notification-service/src/notification/application/event-handler/notification-created.handler.ts` dispatches push only when:
  - the PUSH channel is enabled,
  - the FCM adapter is enabled,
  - `event.recipientDeviceToken` exists.

Phase 5 prerequisite:

- Add or confirm mobile device-token registration and persistence so Flutter can send refreshed FCM tokens to the backend.
- Notification events must be able to resolve the target user's current device token.

## Required next actions

1. Install Flutter SDK, Dart, Firebase CLI, and FlutterFire CLI.
2. Create `vnshop_mobile/` scaffold.
3. Fix Android application id before Firebase registration, likely `com.vnshop.mobile`.
4. Create/select Firebase project and register the Android app.
5. Run `flutterfire configure` from `vnshop_mobile/`.
6. Commit expected non-secret Firebase config outputs according to repo policy.
7. Add mobile CI for `flutter pub get`, `flutter analyze`, tests, and debug Android build.
8. Add mobile `.gitignore` patterns for build output, keystores, and service-account JSON files.
9. Wire `FIREBASE_SERVICE_ACCOUNT` into `notification-service` runtime/deploy config.
10. Implement or verify authenticated mobile FCM token registration before declaring push notifications Phase 5-ready.
