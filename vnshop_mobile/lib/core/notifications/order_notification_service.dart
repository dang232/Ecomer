import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

import '../config/env_config.dart';
import '../notifications/onesignal_handler.dart';
import 'local_notification_service.dart';
import '../../features/orders/data/models/order_model.dart';

/// Order Notification Service for VNShop Mobile
///
/// Handles order-specific push notifications with:
/// - Order status change notifications (confirmed, shipped, delivered)
/// - Personalized message with order details
/// - Deep link to order tracking
///
/// Follows best practices:
/// - Request permission AFTER value demonstration
/// - Personalized = 4x engagement (includes order #, status, ETA)
/// - Opt-in timing: request after first successful order
class OrderNotificationService {
  OrderNotificationService._();

  static OrderNotificationService? _instance;
  static OrderNotificationService get instance =>
      _instance ??= OrderNotificationService._();

  final LocalNotificationService _localNotificationService =
      LocalNotificationService.instance;

  /// Callback for when notification permission is granted
  void Function()? onPermissionGranted;

  /// Callback for when user denies notification permission
  void Function()? onPermissionDenied;

  /// Initialize the order notification service
  Future<void> initialize() async {
    // Set up notification tap callback for order updates
    _localNotificationService.onNotificationTap = _handleNotificationTap;

    // Set up OneSignal handler callback
    OneSignalHandler.instance.onNotificationTap = _handleOneSignalNotification;

    if (kDebugMode) {
      print('📱 OrderNotificationService initialized');
    }
  }

  /// Handle notification tap from local notification
  void _handleNotificationTap(String? payload) {
    if (payload == null) return;

    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      if (data['type'] == 'order_update') {
        _navigateToOrder(
          data['order_id'] as String?,
          data['status'] as String?,
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error parsing notification payload: $e');
      }
    }
  }

  /// Handle OneSignal notification tap
  void _handleOneSignalNotification(
    OneSignalReceivedNotification notification,
  ) {
    if (notification.orderId != null) {
      _navigateToOrder(notification.orderId, notification.status);
    }
  }

  /// Navigate to order detail
  void _navigateToOrder(String? orderId, String? status) {
    if (orderId == null) return;

    if (kDebugMode) {
      print('📱 Navigating to order: $orderId (status: $status)');
    }
    // Navigation is handled by the app router via deep link
    // The payload is passed through and handled by the OrderListBloc
  }

  /// Request notification permission
  ///
  /// Returns true if permission is granted
  /// Should be called AFTER user has seen value (e.g., after first order)
  Future<bool> requestPermission() async {
    if (!EnvConfig.onesignalEnabled) {
      if (kDebugMode) {
        print('📱 OrderNotificationService: OneSignal not configured');
      }
      // In mock mode, simulate permission granted
      onPermissionGranted?.call();
      return true;
    }

    try {
      final granted = await OneSignal.Notifications.requestPermission(false);

      if (granted) {
        onPermissionGranted?.call();
        if (kDebugMode) {
          print('📱 Notification permission granted');
        }
      } else {
        onPermissionDenied?.call();
        if (kDebugMode) {
          print('📱 Notification permission denied');
        }
      }

      return granted;
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error requesting notification permission: $e');
      }
      onPermissionDenied?.call();
      return false;
    }
  }

  /// Show order status update notification
  ///
  /// [order] - The order model
  /// [previousStatus] - The previous status (for transition messages)
  Future<void> showOrderStatusUpdate({
    required OrderModel order,
    OrderStatus? previousStatus,
  }) async {
    final status = order.status;
    final orderNumber = order.orderNumber;
    final orderId = order.id;

    // Get personalized message based on status
    final message = _getStatusMessage(status, order);

    // Show notification
    await _localNotificationService.showOrderStatusUpdate(
      orderId: orderId,
      orderNumber: orderNumber,
      status: status.value,
      message: message,
    );

    if (kDebugMode) {
      print('Order status notification shown: $orderNumber - ${status.value}');
    }
  }

  /// Get personalized status message
  ///
  /// Includes order number, status, and ETA for 4x engagement lift
  String _getStatusMessage(OrderStatus status, OrderModel order) {
    final orderNumber = order.orderNumber;
    final eta = order.estimatedDelivery;

    switch (status) {
      case OrderStatus.confirmed:
        return 'Đơn hàng #$orderNumber đã được xác nhận. Chúng tôi sẽ sớm gửi cho bạn!';
      case OrderStatus.processing:
        return 'Đơn hàng #$orderNumber đang được chuẩn bị. Cảm ơn bạn đã mua sắm!';
      case OrderStatus.shipped:
        final etaText = eta != null ? _formatETA(eta) : 'sớm';
        return 'Đơn hàng #$orderNumber đang được giao! Dự kiến đến $etaText.';
      case OrderStatus.delivered:
        return 'Đơn hàng #$orderNumber đã được giao thành công! Cảm ơn bạn đã tin tưởng VNShop.';
      case OrderStatus.cancelled:
        return 'Đơn hàng #$orderNumber đã bị hủy. Liên hệ shop nếu cần hỗ trợ.';
      case OrderStatus.pending:
        return 'Đơn hàng #$orderNumber đang chờ xác nhận.';
    }
  }

  /// Format ETA for display
  String _formatETA(DateTime eta) {
    final now = DateTime.now();
    final difference = eta.difference(now);

    if (difference.isNegative) {
      return 'hôm nay';
    } else if (difference.inDays == 0) {
      return 'hôm nay';
    } else if (difference.inDays == 1) {
      return 'ngày mai';
    } else if (difference.inDays <= 7) {
      return 'trong ${difference.inDays} ngày';
    } else {
      return 'vào ngày ${eta.day}/${eta.month}';
    }
  }

  /// Subscribe to order notifications for a specific user
  ///
  /// This allows sending targeted notifications to specific users
  Future<void> subscribeToUserOrders(String userId) async {
    if (!EnvConfig.onesignalEnabled) return;

    try {
      await OneSignalHandler.instance.subscribeToTag('user_$userId');
      if (kDebugMode) {
        print('📱 Subscribed to user orders: $userId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error subscribing to user orders: $e');
      }
    }
  }

  /// Unsubscribe from order notifications
  Future<void> unsubscribeFromUserOrders(String userId) async {
    if (!EnvConfig.onesignalEnabled) return;

    try {
      await OneSignalHandler.instance.unsubscribeFromTag('user_$userId');
      if (kDebugMode) {
        print('📱 Unsubscribed from user orders: $userId');
      }
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error unsubscribing from user orders: $e');
      }
    }
  }

  /// Subscribe to all orders topic (for broadcasts)
  Future<void> subscribeToAllOrders() async {
    if (!EnvConfig.onesignalEnabled) return;

    try {
      await OneSignalHandler.instance.subscribeToTag('all_orders');
      if (kDebugMode) {
        print('📱 Subscribed to all orders');
      }
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error subscribing to all orders: $e');
      }
    }
  }

  /// Check if notification permission is granted
  Future<bool> isPermissionGranted() async {
    if (!EnvConfig.onesignalEnabled) {
      return true; // Mock mode - assume granted
    }

    try {
      return OneSignalHandler.instance.isPermissionGranted();
    } catch (e) {
      return false;
    }
  }

  /// Get push token for this device
  Future<String?> getToken() async {
    if (!EnvConfig.onesignalEnabled) {
      return null;
    }

    try {
      return await OneSignalHandler.instance.getPushToken();
    } catch (e) {
      if (kDebugMode) {
        print('📱 Error getting push token: $e');
      }
      return null;
    }
  }
}

/// Extension for creating notification payload from order
extension OrderNotificationPayload on OrderModel {
  /// Create notification payload JSON
  String toNotificationPayload() {
    return jsonEncode({
      'order_id': id,
      'status': status.value,
      'type': 'order_update',
      'order_number': orderNumber,
    });
  }
}
