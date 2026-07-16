import 'dart:async';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:flutter/material.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';
import 'package:path_provider/path_provider.dart';

import 'app/app.dart';
import 'app/bootstrap/app_dependencies.dart';
import 'app/bootstrap/app_initializer.dart';
import 'core/config/env_config.dart';
import 'core/auth/session_controller.dart';
import 'core/notifications/onesignal_handler.dart';
import 'core/notifications/local_notification_service.dart';
import 'core/network/dio_client.dart';
import 'core/storage/hive_storage.dart';
import 'features/auth/data/datasources/auth_local_datasource.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize environment configuration FIRST
  await EnvConfig.initialize();

  // Initialize Hive storage
  await HiveStorage.initialize();

  // Initialize local notifications
  await LocalNotificationService.instance.initialize();

  // Initialize OneSignal
  await _initializeOneSignal();

  // Initialize DioClient BEFORE runApp
  // This must happen before any repository that uses DioClient.instance.dio
  final authLocalDataSource = AuthLocalDataSourceImpl();
  final appDirectory = await getApplicationSupportDirectory();
  final cookieJar = PersistCookieJar(
    storage: FileStorage('${appDirectory.path}/vnshop_cookies'),
  );
  final sessionController = SessionController(
    clearTokens: authLocalDataSource.clearAuthData,
  );
  DioClient.instance.initialize(
    getAccessToken: authLocalDataSource.getAccessToken,
    getRefreshToken: authLocalDataSource.getRefreshToken,
    saveTokens: (accessToken, refreshToken) => authLocalDataSource.saveTokens(
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiry: DateTime.now().add(const Duration(hours: 1)),
    ),
    clearTokens: authLocalDataSource.clearAuthData,
    cookieJar: cookieJar,
    onSessionExpired: () {
      unawaited(sessionController.expireSession());
    },
  );

  final dependencies = AppDependencies.production(
    authLocalDataSource: authLocalDataSource,
  );
  await AppInitializer.production().initialize();

  runApp(
    VnShopApp(sessionController: sessionController, dependencies: dependencies),
  );
}

Future<void> _initializeOneSignal() async {
  // OneSignal app ID from environment
  final appId = EnvConfig.onesignalAppId;

  if (appId.isEmpty) {
    return; // Skip if not configured
  }

  OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
  OneSignal.initialize(appId);

  // Initialize our handler
  await OneSignalHandler.instance.initialize();

  // Request permission
  await OneSignal.Notifications.requestPermission(false);

  // Sync token
  await OneSignalHandler.instance.syncToken();
}
