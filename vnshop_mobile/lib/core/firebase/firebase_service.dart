import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Firebase Service - Mock implementation
/// 
/// NOTE: This is a mock implementation until `flutterfire configure` completes.
/// When firebase_core is properly configured, replace this with actual Firebase initialization.
class FirebaseService {
  FirebaseService._();

  static FirebaseService? _instance;
  static FirebaseService get instance => _instance ??= FirebaseService._();

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  /// Initialize Firebase
  /// In production, this would call Firebase.initializeApp()
  Future<void> initialize() async {
    if (_isInitialized) return;

    if (kDebugMode) {
      print('🔥 FirebaseService: Mock initialization (configure flutterfire to enable)');
    }

    // TODO: Replace with actual Firebase initialization after flutterfire configure
    // await Firebase.initializeApp(
    //   options: DefaultFirebaseOptions.currentPlatform,
    // );

    _isInitialized = true;
  }

  /// Get the current Firebase App instance
  /// Returns null if not initialized (mock mode)
  FirebaseApp? get app {
    if (!_isInitialized) return null;
    // TODO: return Firebase.app();
    return null;
  }

  /// Check if Firebase is properly configured
  static bool get isConfigured {
    // TODO: Check for google-services.json or GoogleService-Info.plist
    return false;
  }

  /// Get messaging instance (mock)
  // FirebaseMessaging? get messaging {
  //   if (!_isInitialized) return null;
  //   return FirebaseMessaging.instance;
  // }

  /// Get remote config instance (mock)
  // FirebaseRemoteConfig? get remoteConfig {
  //   if (!_isInitialized) return null;
  //   return FirebaseRemoteConfig.instance;
  // }

  /// Check if running in debug mode with mock Firebase
  static bool get isMockMode => !isConfigured;
}
