import 'package:flutter/material.dart';

import 'app/app.dart';
import 'core/config/env_config.dart';
import 'core/firebase/firebase_service.dart';
import 'core/firebase/fcm_handler.dart';
import 'core/notifications/local_notification_service.dart';
import 'core/storage/hive_storage.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize environment configuration FIRST
  await EnvConfig.initialize();

  // Initialize Hive storage
  await HiveStorage.initialize();

  // Initialize Firebase (mock until flutterfire configure completes)
  await FirebaseService.instance.initialize();

  // Initialize local notifications
  await LocalNotificationService.instance.initialize();

  // Register background FCM handler AFTER Firebase.initializeApp
  // This must be done before runApp for background message handling to work
  await FcmHandler.instance.initialize();

  runApp(const VnShopApp());
}
