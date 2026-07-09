import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

import 'order_item_model.dart';

part 'order_model.g.dart';

@HiveType(typeId: 2)
enum OrderStatus {
  @HiveField(0)
  pending('Chờ xác nhận', 'PENDING'),
  @HiveField(1)
  confirmed('Đã xác nhận', 'CONFIRMED'),
  @HiveField(2)
  processing('Đang xử lý', 'PROCESSING'),
  @HiveField(3)
  shipped('Đang giao hàng', 'SHIPPED'),
  @HiveField(4)
  delivered('Đã giao hàng', 'DELIVERED'),
  @HiveField(5)
  cancelled('Đã hủy', 'CANCELLED');

  final String label;
  final String value;

  const OrderStatus(this.label, this.value);

  static OrderStatus fromString(String value) {
    return OrderStatus.values.firstWhere(
      (e) => e.value == value.toUpperCase(),
      orElse: () => OrderStatus.pending,
    );
  }
}

@HiveType(typeId: 1)
class OrderModel extends Equatable {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String orderNumber;

  @HiveField(2)
  final OrderStatus status;

  @HiveField(3)
  final List<OrderItemModel> items;

  @HiveField(4)
  final double subtotal;

  @HiveField(5)
  final double shippingFee;

  @HiveField(6)
  final double discount;

  @HiveField(7)
  final double totalAmount;

  @HiveField(8)
  final String? shippingAddress;

  @HiveField(9)
  final String? shippingCity;

  @HiveField(10)
  final String? shippingDistrict;

  @HiveField(11)
  final String? shippingWard;

  @HiveField(12)
  final String? shippingPhone;

  @HiveField(13)
  final String? shippingName;

  @HiveField(14)
  final String? note;

  @HiveField(15)
  final DateTime createdAt;

  @HiveField(16)
  final DateTime? updatedAt;

  @HiveField(17)
  final DateTime? estimatedDelivery;

  @HiveField(18)
  final String? trackingNumber;

  @HiveField(19)
  final String? paymentMethod;

  @HiveField(20)
  final bool isPaid;

  const OrderModel({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.items,
    required this.subtotal,
    required this.shippingFee,
    this.discount = 0.0,
    required this.totalAmount,
    this.shippingAddress,
    this.shippingCity,
    this.shippingDistrict,
    this.shippingWard,
    this.shippingPhone,
    this.shippingName,
    this.note,
    required this.createdAt,
    this.updatedAt,
    this.estimatedDelivery,
    this.trackingNumber,
    this.paymentMethod,
    this.isPaid = false,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    return OrderModel(
      id: json['id'] as String,
      orderNumber: json['order_number'] as String? ?? json['orderNumber'] as String? ?? '',
      status: OrderStatus.fromString(json['status'] as String? ?? 'PENDING'),
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => OrderItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          (json['order_items'] as List<dynamic>?)
              ?.map((e) => OrderItemModel.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      subtotal: (json['subtotal'] as num?)?.toDouble() ??
          (json['sub_total'] as num?)?.toDouble() ??
          0.0,
      shippingFee: (json['shipping_fee'] as num?)?.toDouble() ??
          (json['shippingFee'] as num?)?.toDouble() ??
          0.0,
      discount: (json['discount'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (json['total_amount'] as num?)?.toDouble() ??
          (json['totalAmount'] as num?)?.toDouble() ??
          0.0,
      shippingAddress: json['shipping_address'] as String? ??
          json['shippingAddress'] as String?,
      shippingCity: json['shipping_city'] as String? ?? json['shippingCity'] as String?,
      shippingDistrict:
          json['shipping_district'] as String? ?? json['shippingDistrict'] as String?,
      shippingWard: json['shipping_ward'] as String? ?? json['shippingWard'] as String?,
      shippingPhone: json['shipping_phone'] as String? ?? json['shippingPhone'] as String?,
      shippingName: json['shipping_name'] as String? ?? json['shippingName'] as String?,
      note: json['note'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : json['createdAt'] != null
              ? DateTime.parse(json['createdAt'] as String)
              : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : json['updatedAt'] != null
              ? DateTime.parse(json['updatedAt'] as String)
              : null,
      estimatedDelivery: json['estimated_delivery'] != null
          ? DateTime.parse(json['estimated_delivery'] as String)
          : json['estimatedDelivery'] != null
              ? DateTime.parse(json['estimatedDelivery'] as String)
              : null,
      trackingNumber:
          json['tracking_number'] as String? ?? json['trackingNumber'] as String?,
      paymentMethod: json['payment_method'] as String? ?? json['paymentMethod'] as String?,
      isPaid: json['is_paid'] as bool? ?? json['isPaid'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_number': orderNumber,
      'status': status.value,
      'items': items.map((e) => e.toJson()).toList(),
      'subtotal': subtotal,
      'shipping_fee': shippingFee,
      'discount': discount,
      'total_amount': totalAmount,
      'shipping_address': shippingAddress,
      'shipping_city': shippingCity,
      'shipping_district': shippingDistrict,
      'shipping_ward': shippingWard,
      'shipping_phone': shippingPhone,
      'shipping_name': shippingName,
      'note': note,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'estimated_delivery': estimatedDelivery?.toIso8601String(),
      'tracking_number': trackingNumber,
      'payment_method': paymentMethod,
      'is_paid': isPaid,
    };
  }

  OrderModel copyWith({
    String? id,
    String? orderNumber,
    OrderStatus? status,
    List<OrderItemModel>? items,
    double? subtotal,
    double? shippingFee,
    double? discount,
    double? totalAmount,
    String? shippingAddress,
    String? shippingCity,
    String? shippingDistrict,
    String? shippingWard,
    String? shippingPhone,
    String? shippingName,
    String? note,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? estimatedDelivery,
    String? trackingNumber,
    String? paymentMethod,
    bool? isPaid,
  }) {
    return OrderModel(
      id: id ?? this.id,
      orderNumber: orderNumber ?? this.orderNumber,
      status: status ?? this.status,
      items: items ?? this.items,
      subtotal: subtotal ?? this.subtotal,
      shippingFee: shippingFee ?? this.shippingFee,
      discount: discount ?? this.discount,
      totalAmount: totalAmount ?? this.totalAmount,
      shippingAddress: shippingAddress ?? this.shippingAddress,
      shippingCity: shippingCity ?? this.shippingCity,
      shippingDistrict: shippingDistrict ?? this.shippingDistrict,
      shippingWard: shippingWard ?? this.shippingWard,
      shippingPhone: shippingPhone ?? this.shippingPhone,
      shippingName: shippingName ?? this.shippingName,
      note: note ?? this.note,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      estimatedDelivery: estimatedDelivery ?? this.estimatedDelivery,
      trackingNumber: trackingNumber ?? this.trackingNumber,
      paymentMethod: paymentMethod ?? this.paymentMethod,
      isPaid: isPaid ?? this.isPaid,
    );
  }

  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  String get fullShippingAddress {
    final parts = [shippingWard, shippingDistrict, shippingCity, shippingAddress]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.join(', ');
  }

  @override
  List<Object?> get props => [
        id,
        orderNumber,
        status,
        items,
        subtotal,
        shippingFee,
        discount,
        totalAmount,
        shippingAddress,
        shippingCity,
        shippingDistrict,
        shippingWard,
        shippingPhone,
        shippingName,
        note,
        createdAt,
        updatedAt,
        estimatedDelivery,
        trackingNumber,
        paymentMethod,
        isPaid,
      ];
}
