import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import '../notifications/local_notification_service.dart';

/// OneSignal Handler for VNShop Mobile
///
/// Handles:
/// - Background message handling
/// - Foreground message handling
/// - Notification tap deep linking
/// - Push token management
class OneSignalHandler {
  OneSignalHandler._();

  static OneSignalHandler? _instance;
  static OneSignalHandler get instance => _instance ??= OneSignalHandler._();

  final LocalNotificationService _notificationService = LocalNotificationService.instance;

  /// Callback for notification tap with deep link
  void Function(OneSignalReceivedNotification notification)? onNotificationTap;

  bool _isInitialized = false;
  bool get isInitialized => _isInitialized;

  /// Initialize OneSignal handler
  /// Must be called after OneSignal SDK is initialized
  Future<void> initialize() async {
    if (_isInitialized) return;

    if (kDebugMode) {
      print('🔔 OneSignalHandler: Initializing...');
    }

    // Enable debug logging in debug mode
    OneSignal.Debug.setLogLevel(OSLogLevel.verbose);

    // Set notification received handler (foreground)
    OneSignal.Notifications.addForegroundWillDisplayListener(
      _handleForegroundNotification,
    );

    // Set notification tap handler
    OneSignal.Notifications.addClickListener(_handleNotificationTap);

    // Set permission observer
    OneSignal.Notifications.addPermissionObserver(_handlePermissionChange);

    // Check initial permission status
    _checkPermissionStatus();

    _isInitialized = true;

    if (kDebugMode) {
      print('🔔 OneSignalHandler: Initialized successfully');
    }
  }

  /// Handle foreground notification display
  Future<void> _handleForegroundNotification(OSNotificationWillDisplayEvent event) async {
    if (kDebugMode) {
      print('🔔 Foreground notification received: ${event.notification.title}');
    }

    // Parse order data if available
    Map<String, dynamic>? orderData;
    final additionalData = event.notification.additionalData;
    if (additionalData != null && additionalData['order_id'] != null) {
      orderData = {
        'order_id': additionalData['order_id'],
        'status': additionalData['status'],
        'type': 'order_update',
      };
    }

    // Display the notification using local notifications
    await _notificationService.show(
      id: event.notification.hashCode,
      title: event.notification.title ?? 'VNShop',
      body: event.notification.body ?? '',
      payload: orderData != null ? jsonEncode(orderData) : null,
      androidDetails: AndroidNotificationDetails(
        'vnshop_orders',
        'Đơn hàng',
        channelDescription: 'Thông báo về đơn hàng của bạn',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iosDetails: const DarwinNotificationDetails(
        presentAlert: true,
        presentBadge: true,
        presentSound: true,
      ),
    );

    // Prevent default display (we showed it via local notifications)
    event.preventDefault();
  }

  /// Handle notification tap
  void _handleNotificationTap(OSNotificationClickEvent event) {
    if (kDebugMode) {
      print('🔔 Notification tapped: ${event.notification.title}');
    }

    final additionalData = event.notification.additionalData;
    if (additionalData != null) {
      final notification = OneSignalReceivedNotification(
        title: event.notification.title ?? '',
        body: event.notification.body ?? '',
        data: Map<String, dynamic>.from(additionalData),
      );
      onNotificationTap?.call(notification);
    }
  }

  /// Handle permission changes
  void _handlePermissionChange(bool hasPermission) {
    if (kDebugMode) {
      print('🔔 Notification permission changed: $hasPermission');
    }
  }

  /// Check and log current permission status
  void _checkPermissionStatus() {
    final status = OneSignal.Notifications.permission;
    if (kDebugMode) {
      print('🔔 Current permission status: $status');
    }
  }

  /// Get OneSignal user ID (onesignal_id)
  Future<String?> getUserId() async {
    try {
      final userId = await OneSignal.User.getOnesignalId();
      return userId;
    } catch (e) {
      if (kDebugMode) {
        print('🔔 Error getting OneSignal user ID: $e');
      }
      return null;
    }
  }

  /// Get push subscription ID (device token)
  Future<String?> getPushToken() async {
    try {
      final token = OneSignal.User.pushSubscription.token;
      return token;
    } catch (e) {
      if (kDebugMode) {
        print('🔔 Error getting push token: $e');
      }
      return null;
    }
  }

  /// Sync push token to server
  Future<void> syncToken() async {
    try {
      final userId = await getUserId();
      final token = await getPushToken();

      if (kDebugMode) {
        print('🔔 OneSignal Token: $token, UserID: $userId');
      }

      // TODO: Send token to server
      // await _authRepository.syncPushToken(userId, token);
    } catch (e) {
      if (kDebugMode) {
        print('🔔 OneSignal Token sync error: $e');
      }
    }
  }

  /// Check if notification permission is granted
  bool isPermissionGranted() {
    return OneSignal.Notifications.permission;
  }

  /// Request notification permission
  Future<bool> requestPermission() async {
    try {
      // false = don't show fallback to email prompt
      final granted = await OneSignal.Notifications.requestPermission(false);
      return granted;
    } catch (e) {
      if (kDebugMode) {
        print('🔔 OneSignal permission request error: $e');
      }
      return false;
    }
  }

  /// Subscribe to a tag (equivalent to FCM topic)
  Future<void> subscribeToTag(String tag) async {
    try {
      await OneSignal.User.addTags({tag: 'true'});
      if (kDebugMode) {
        print('🔔 Subscribed to tag: $tag');
      }
    } catch (e) {
      if (kDebugMode) {
        print('🔔 Error subscribing to tag: $e');
      }
    }
  }

  /// Unsubscribe from a tag
  Future<void> unsubscribeFromTag(String tag) async {
    try {
      await OneSignal.User.removeTags([tag]);
      if (kDebugMode) {
        print('🔔 Unsubscribed from tag: $tag');
      }
    } catch (e) {
      if (kDebugMode) {
        print('🔔 Error unsubscribing from tag: $e');
      }
    }
  }

  /// Dispose handler
  void dispose() {
    _isInitialized = false;
  }
}

/// Notification received from OneSignal tap
class OneSignalReceivedNotification {
  final String title;
  final String body;
  final Map<String, dynamic> data;

  OneSignalReceivedNotification({
    required this.title,
    required this.body,
    required this.data,
  });

  /// Get order ID from notification data
  String? get orderId => data['order_id'] as String?;

  /// Get order status from notification data
  String? get status => data['status'] as String?;

  /// Get notification type
  String? get type => data['type'] as String?;

  /// Get deep link path for this notification
  String? get deepLink {
    if (type == 'order_update' && orderId != null) {
      return '/orders/$orderId';
    }
    return null;
  }
}
