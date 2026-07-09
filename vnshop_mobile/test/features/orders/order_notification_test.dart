import 'package:flutter_test/flutter_test.dart';
import 'package:vnshop_mobile/core/notifications/order_notification_service.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_model.dart';
import 'package:vnshop_mobile/features/orders/data/models/order_item_model.dart';

void main() {
  group('OrderNotificationService', () {
    late OrderModel testOrder;

    setUp(() {
      testOrder = OrderModel(
        id: 'order_123',
        orderNumber: 'VN20240101001',
        status: OrderStatus.confirmed,
        items: const [
          OrderItemModel(
            id: 'item_1',
            productId: 'prod_1',
            productName: 'Test Product',
            productImage: 'https://example.com/image.jpg',
            quantity: 2,
            price: 100000.0,
            totalPrice: 200000.0,
          ),
        ],
        subtotal: 200000.0,
        shippingFee: 15000.0,
        discount: 0.0,
        totalAmount: 215000.0,
        shippingAddress: '123 Main St',
        shippingCity: 'Ho Chi Minh City',
        shippingDistrict: 'District 1',
        shippingWard: 'Ward 1',
        shippingPhone: '0123456789',
        shippingName: 'Test User',
        createdAt: DateTime(2024, 1, 1),
        updatedAt: DateTime(2024, 1, 1),
        estimatedDelivery: DateTime(2024, 1, 5),
        trackingNumber: 'TRACK123',
        paymentMethod: 'COD',
        isPaid: false,
      );
    });

    group('OrderNotificationPayload extension', () {
      test('toNotificationPayload returns correct JSON', () {
        final payload = testOrder.toNotificationPayload();

        expect(payload, contains('"order_id":"order_123"'));
        expect(payload, contains('"status":"CONFIRMED"'));
        expect(payload, contains('"type":"order_update"'));
        expect(payload, contains('"order_number":"VN20240101001"'));
      });

      test('toNotificationPayload works for all order statuses', () {
        final statuses = [
          OrderStatus.pending,
          OrderStatus.confirmed,
          OrderStatus.processing,
          OrderStatus.shipped,
          OrderStatus.delivered,
          OrderStatus.cancelled,
        ];

        for (final status in statuses) {
          final order = testOrder.copyWith(status: status);
          final payload = order.toNotificationPayload();

          expect(payload, contains('"order_id":"order_123"'));
          expect(payload, contains('"status":"${status.value}"'));
        }
      });
    });

    group('Service initialization', () {
      test('singleton instance is created', () {
        final instance1 = OrderNotificationService.instance;
        final instance2 = OrderNotificationService.instance;

        expect(instance1, equals(instance2));
      });

      test('instance is of correct type', () {
        expect(OrderNotificationService.instance, isA<OrderNotificationService>());
      });
    });
  });

  group('OrderModel notification data', () {
    test('order with estimated delivery has correct ETA format', () {
      final order = OrderModel(
        id: 'order_1',
        orderNumber: 'VN001',
        status: OrderStatus.shipped,
        items: const [],
        subtotal: 100000.0,
        shippingFee: 10000.0,
        totalAmount: 110000.0,
        createdAt: DateTime.now(),
        estimatedDelivery: DateTime.now().add(const Duration(days: 2)),
      );

      expect(order.estimatedDelivery, isNotNull);
      expect(order.estimatedDelivery!.isAfter(DateTime.now()), isTrue);
    });

    test('order without estimated delivery returns null', () {
      final order = OrderModel(
        id: 'order_1',
        orderNumber: 'VN001',
        status: OrderStatus.pending,
        items: const [],
        subtotal: 100000.0,
        shippingFee: 10000.0,
        totalAmount: 110000.0,
        createdAt: DateTime.now(),
        estimatedDelivery: null,
      );

      expect(order.estimatedDelivery, isNull);
    });

    test('order status values are correct', () {
      expect(OrderStatus.pending.value, equals('PENDING'));
      expect(OrderStatus.confirmed.value, equals('CONFIRMED'));
      expect(OrderStatus.processing.value, equals('PROCESSING'));
      expect(OrderStatus.shipped.value, equals('SHIPPED'));
      expect(OrderStatus.delivered.value, equals('DELIVERED'));
      expect(OrderStatus.cancelled.value, equals('CANCELLED'));
    });

    test('order status labels are in Vietnamese', () {
      expect(OrderStatus.pending.label, equals('Chờ xác nhận'));
      expect(OrderStatus.confirmed.label, equals('Đã xác nhận'));
      expect(OrderStatus.processing.label, equals('Đang xử lý'));
      expect(OrderStatus.shipped.label, equals('Đang giao hàng'));
      expect(OrderStatus.delivered.label, equals('Đã giao hàng'));
      expect(OrderStatus.cancelled.label, equals('Đã hủy'));
    });

    test('order status fromString parses correctly', () {
      expect(OrderStatus.fromString('PENDING'), equals(OrderStatus.pending));
      expect(OrderStatus.fromString('confirmed'), equals(OrderStatus.confirmed));
      expect(OrderStatus.fromString('SHIPPED'), equals(OrderStatus.shipped));
      expect(OrderStatus.fromString('invalid'), equals(OrderStatus.pending));
    });
  });

  group('Notification best practices', () {
    test('order number is included for personalization', () {
      final order = OrderModel(
        id: 'order_1',
        orderNumber: 'VN20240101001',
        status: OrderStatus.shipped,
        items: const [],
        subtotal: 100000.0,
        shippingFee: 10000.0,
        totalAmount: 110000.0,
        createdAt: DateTime.now(),
      );

      expect(order.orderNumber, isNotEmpty);
      expect(order.orderNumber, contains('VN'));
    });

    test('order status change tracking is possible', () {
      final originalOrder = OrderModel(
        id: 'order_1',
        orderNumber: 'VN001',
        status: OrderStatus.pending,
        items: const [],
        subtotal: 100000.0,
        shippingFee: 10000.0,
        totalAmount: 110000.0,
        createdAt: DateTime.now(),
      );

      final updatedOrder = originalOrder.copyWith(status: OrderStatus.confirmed);

      expect(originalOrder.status, equals(OrderStatus.pending));
      expect(updatedOrder.status, equals(OrderStatus.confirmed));
    });

    test('ETA is available for shipping notifications', () {
      final order = OrderModel(
        id: 'order_1',
        orderNumber: 'VN001',
        status: OrderStatus.shipped,
        items: const [],
        subtotal: 100000.0,
        shippingFee: 10000.0,
        totalAmount: 110000.0,
        createdAt: DateTime.now(),
        estimatedDelivery: DateTime.now().add(const Duration(days: 3)),
      );

      expect(order.estimatedDelivery, isNotNull);
    });
  });
}
