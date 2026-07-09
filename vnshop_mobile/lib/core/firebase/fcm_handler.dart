import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'firebase_service.dart';
import '../notifications/local_notification_service.dart';

/// FCM Handler for VNShop Mobile
/// 
/// Handles:
/// - Background message handling (top-level handler)
/// - Foreground message handling
/// - Notification tap deep linking
class FcmHandler {
  FcmHandler._();

  static FcmHandler? _instance;
  static FcmHandler get instance => _instance ??= FcmHandler._();

  // Lazy initialization - FirebaseMessaging.instance is accessed only when needed
  FirebaseMessaging? _messaging;
  FirebaseMessaging get _firebaseMessaging {
    _messaging ??= FirebaseMessaging.instance;
    return _messaging!;
  }
  
  final LocalNotificationService _notificationService = LocalNotificationService.instance;

  /// Callback for notification tap with deep link
  void Function(RemoteMessage message)? onNotificationTap;

  /// Initialize FCM handler
  /// Must be called after Firebase.initializeApp()
  Future<void> initialize() async {
    // Check if Firebase is configured before accessing FirebaseMessaging
    if (!FirebaseService.isConfigured || FirebaseService.isMockMode) {
      if (kDebugMode) {
        print('🔔 FcmHandler: Running in mock mode (Firebase not configured)');
      }
      return;
    }

    // Request notification permissions
    await _requestPermission();

    // Set up foreground message handler
    FirebaseMessaging.onMessage.listen(_handleForegroundMessage);

    // Set up background message handler (when app is in background/terminated)
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle notification tap when app opens from terminated state
    final initialMessage = await _firebaseMessaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // Handle notification tap when app opens from background state
    FirebaseMessaging.onMessageOpenedApp.listen(_handleNotificationTap);

    // Get and sync FCM token
    await _syncToken();
  }

  /// Request notification permission
  Future<bool> _requestPermission() async {
    try {
      final settings = await _firebaseMessaging.requestPermission(
        alert: true,
        announcement: false,
        badge: true,
        carPlay: false,
        criticalAlert: false,
        provisional: false,
        sound: true,
      );

      if (kDebugMode) {
        print('🔔 FCM Permission status: ${settings.authorizationStatus}');
      }

      return settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional;
    } catch (e) {
      if (kDebugMode) {
        print('🔔 FCM Permission error: $e');
      }
      return false;
    }
  }

  /// Sync FCM token to server
  Future<void> _syncToken() async {
    try {
      final token = await _firebaseMessaging.getToken();
      if (token != null) {
        if (kDebugMode) {
          print('🔔 FCM Token: $token');
        }
        // TODO: Send token to server
        // await _authRepository.syncFcmToken(token);
      }

      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        if (kDebugMode) {
          print('🔔 FCM Token refreshed: $newToken');
        }
        // TODO: Send new token to server
      });
    } catch (e) {
      if (kDebugMode) {
        print('🔔 FCM Token error: $e');
      }
    }
  }

  /// Handle foreground message
  Future<void> _handleForegroundMessage(RemoteMessage message) async {
    if (kDebugMode) {
      print('🔔 Foreground message received: ${message.messageId}');
    }

    await _showForegroundNotification(message);
  }

  /// Handle notification tap
  void _handleNotificationTap(RemoteMessage message) {
    if (kDebugMode) {
      print('🔔 Notification tapped: ${message.messageId}');
    }

    onNotificationTap?.call(message);
  }

  /// Show foreground notification using flutter_local_notifications
  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final notification = message.notification;
    if (notification == null) return;

    final AndroidNotification? android = message.notification?.android;

    // Parse order data if available
    Map<String, dynamic>? orderData;
    if (message.data['order_id'] != null) {
      orderData = {
        'order_id': message.data['order_id'],
        'status': message.data['status'],
        'type': 'order_update',
      };
    }

    await _notificationService.show(
      id: message.hashCode,
      title: notification.title ?? 'VNShop',
      body: notification.body ?? '',
      payload: orderData != null ? jsonEncode(orderData) : null,
      androidDetails: AndroidNotificationDetails(
        'vnshop_orders', // Channel ID
        'Đơn hàng', // Channel name
        channelDescription: 'Thông báo về đơn hàng của bạn',
        importance: Importance.high,
        priority: Priority.high,
        icon: android?.smallIcon,
        largeIcon: android?.imageUrl != null
            ? DrawableResourceAndroidBitmap(android!.imageUrl!)
            : null,
        styleInformation: BigTextStyleInformation(
          notification.body ?? '',
          contentTitle: notification.title,
          summaryText: 'VNShop',
        ),
      ),
      iosDetails: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );
  }

  /// Get FCM token
  Future<String?> getToken() async {
    if (FirebaseService.isMockMode || !FirebaseService.isConfigured) return null;
    return _firebaseMessaging.getToken();
  }

  /// Subscribe to topic
  Future<void> subscribeToTopic(String topic) async {
    if (FirebaseService.isMockMode || !FirebaseService.isConfigured) return;
    await _firebaseMessaging.subscribeToTopic(topic);
  }

  /// Unsubscribe from topic
  Future<void> unsubscribeFromTopic(String topic) async {
    if (FirebaseService.isMockMode || !FirebaseService.isConfigured) return;
    await _firebaseMessaging.unsubscribeFromTopic(topic);
  }
}

/// Background message handler - MUST be a top-level function with @pragma('vm:entry-point')
/// This is required for background message handling on Android
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Initialize Firebase if not already done
  // This is required for background message handling
  if (!FirebaseService.instance.isInitialized) {
    await FirebaseService.instance.initialize();
  }

  if (kDebugMode) {
    print('🔔 Background message received: ${message.messageId}');
  }

  // Parse order data if available
  Map<String, dynamic>? orderData;
  if (message.data['order_id'] != null) {
    orderData = {
      'order_id': message.data['order_id'],
      'status': message.data['status'],
      'type': 'order_update',
    };
  }

  // Show notification using local notifications
  // Note: This runs in a separate isolate in background
  final notification = message.notification;
  if (notification != null) {
    // For background notifications, we use a simplified approach
    // since LocalNotificationService might not be initialized yet
    await LocalNotificationService.instance.show(
      id: message.hashCode,
      title: notification.title ?? 'VNShop',
      body: notification.body ?? '',
      payload: orderData != null ? jsonEncode(orderData) : null,
    );
  }
}

/// Parse notification payload to extract navigation data
class NotificationPayload {
  final String? orderId;
  final String? status;
  final String? type;

  NotificationPayload({
    this.orderId,
    this.status,
    this.type,
  });

  factory NotificationPayload.fromJson(String payload) {
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      return NotificationPayload(
        orderId: data['order_id'] as String?,
        status: data['status'] as String?,
        type: data['type'] as String?,
      );
    } catch (e) {
      return NotificationPayload();
    }
  }

  /// Get deep link path for this notification
  String? get deepLink {
    if (type == 'order_update' && orderId != null) {
      return '/orders/$orderId';
    }
    return null;
  }
}
