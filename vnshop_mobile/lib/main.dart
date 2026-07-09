import 'package:flutter/material.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import 'app/app.dart';
import 'core/config/env_config.dart';
import 'core/notifications/onesignal_handler.dart';
import 'core/notifications/local_notification_service.dart';
import 'core/storage/hive_storage.dart';

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

  runApp(const VnShopApp());
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
