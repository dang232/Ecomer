import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

/// Local Notification Service for VNShop Mobile
///
/// Handles:
/// - Android notification channel setup
/// - Foreground notifications
/// - Notification tap handling
class LocalNotificationService {
  LocalNotificationService._();

  static LocalNotificationService? _instance;
  static LocalNotificationService get instance =>
      _instance ??= LocalNotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  bool _isInitialized = false;

  /// Callback when notification is tapped
  void Function(String? payload)? onNotificationTap;

  /// Initialize the notification service
  Future<void> initialize() async {
    if (_isInitialized) return;

    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: false,
      requestBadgePermission: false,
      requestSoundPermission: false,
    );

    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    // Initialize the plugin
    await _plugin.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: _onNotificationResponse,
    );

    // Create Android notification channel
    await _createAndroidChannel();

    _isInitialized = true;

    if (kDebugMode) {
      print('🔔 LocalNotificationService initialized');
    }
  }

  /// Create Android notification channel (required for Android 8.0+)
  Future<void> _createAndroidChannel() async {
    if (!Platform.isAndroid) return;

    const channel = AndroidNotificationChannel(
      'vnshop_default', // Channel ID
      'VNShop Notifications', // Channel name
      description: 'Thông báo từ VNShop', // Channel description
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
      enableLights: true,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);

    // Create order-specific channel
    const orderChannel = AndroidNotificationChannel(
      'vnshop_orders', // Channel ID
      'Đơn hàng', // Channel name
      description: 'Thông báo về đơn hàng của bạn',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );

    await _plugin
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(orderChannel);

    if (kDebugMode) {
      print('🔔 Android notification channels created');
    }
  }

  /// Handle notification tap
  void _onNotificationResponse(NotificationResponse response) {
    if (kDebugMode) {
      print('🔔 Notification tapped: ${response.payload}');
    }
    onNotificationTap?.call(response.payload);
  }

  /// Show a notification
  Future<void> show({
    required int id,
    required String title,
    required String body,
    String? payload,
    AndroidNotificationDetails? androidDetails,
    DarwinNotificationDetails? iosDetails,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    // Use default Android details if not provided
    final android =
        androidDetails ??
        const AndroidNotificationDetails(
          'vnshop_default',
          'VNShop Notifications',
          importance: Importance.high,
          priority: Priority.high,
        );

    const ios = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    await _plugin.show(
      id: id,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: android,
        iOS: iosDetails ?? ios,
      ),
      payload: payload,
    );
  }

  /// Show order status update notification
  Future<void> showOrderStatusUpdate({
    required String orderId,
    required String orderNumber,
    required String status,
    String? message,
  }) async {
    final title = 'Cập nhật đơn hàng #$orderNumber';
    final body = message ?? _getStatusMessage(status);

    final payload =
        '{"order_id": "$orderId", "status": "$status", "type": "order_update"}';

    await show(
      id: orderId.hashCode,
      title: title,
      body: body,
      payload: payload,
      androidDetails: AndroidNotificationDetails(
        'vnshop_orders',
        'Đơn hàng',
        importance: Importance.high,
        priority: Priority.high,
        styleInformation: BigTextStyleInformation(
          body,
          contentTitle: title,
          summaryText: 'VNShop',
        ),
      ),
    );
  }

  /// Get status message in Vietnamese
  String _getStatusMessage(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return 'Đơn hàng của bạn đang chờ xác nhận';
      case 'CONFIRMED':
        return 'Đơn hàng đã được xác nhận';
      case 'PROCESSING':
        return 'Đơn hàng đang được chuẩn bị';
      case 'SHIPPED':
        return 'Đơn hàng đang được giao đến bạn';
      case 'DELIVERED':
        return 'Đơn hàng đã được giao thành công';
      case 'CANCELLED':
        return 'Đơn hàng đã bị hủy';
      default:
        return 'Có cập nhật mới về đơn hàng của bạn';
    }
  }

  /// Cancel a notification
  Future<void> cancel(int id) async {
    await _plugin.cancel(id: id);
  }

  /// Cancel all notifications
  Future<void> cancelAll() async {
    await _plugin.cancelAll();
  }

  /// Get pending notifications
  Future<List<PendingNotificationRequest>> getPendingNotifications() async {
    return _plugin.pendingNotificationRequests();
  }

  /// Check if notifications are enabled
  Future<bool> areNotificationsEnabled() async {
    if (Platform.isAndroid) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      return await androidPlugin?.areNotificationsEnabled() ?? false;
    }
    // For iOS, we'd need to check settings
    return true;
  }

  /// Request notification permission (for Android 13+)
  Future<bool> requestPermission() async {
    if (Platform.isAndroid) {
      final androidPlugin = _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >();
      return await androidPlugin?.requestNotificationsPermission() ?? false;
    }
    return true;
  }

  /// Schedule a notification
  /// Note: Requires timezone package for production use
  Future<void> schedule({
    required int id,
    required String title,
    required String body,
    required DateTime scheduledDate,
    String? payload,
  }) async {
    if (!_isInitialized) {
      await initialize();
    }

    // Note: zonedSchedule requires timezone package
    // For basic scheduling without timezone, we skip scheduling for now
    // In production, add timezone package and use proper TZDateTime
    if (kDebugMode) {
      print('🔔 Schedule notification requires timezone package');
    }
  }
}
