import 'package:equatable/equatable.dart';
import 'package:hive_ce/hive.dart';

import 'order_item_model.dart';

part 'order_model.g.dart';

@HiveType(typeId: 2)
enum OrderStatus {
  @HiveField(0)
  pending('PENDING'),
  @HiveField(1)
  confirmed('CONFIRMED'),
  @HiveField(2)
  processing('PROCESSING'),
  @HiveField(3)
  shipped('SHIPPED'),
  @HiveField(4)
  delivered('DELIVERED'),
  @HiveField(5)
  cancelled('CANCELLED');

  final String value;

  const OrderStatus(this.value);

  static OrderStatus fromString(String? value) {
    final normalized = (value ?? '').trim().toUpperCase();
    if (normalized.contains('CANCEL') || normalized.contains('REJECT')) {
      return OrderStatus.cancelled;
    }
    if (normalized.contains('PENDING')) return OrderStatus.pending;
    if (normalized.contains('DELIVER')) return OrderStatus.delivered;
    if (normalized.contains('SHIP')) return OrderStatus.shipped;
    if (normalized.contains('PACK') ||
        normalized.contains('ACCEPT') ||
        normalized.contains('CONFIRM')) {
      return OrderStatus.confirmed;
    }
    if (normalized.contains('PROCESS')) return OrderStatus.processing;
    return OrderStatus.pending;
  }

  static OrderStatus fromFulfillmentStatuses(Iterable<String> values) {
    final statuses = values
        .map((value) => value.trim().toUpperCase())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
    if (statuses.isEmpty) return OrderStatus.pending;

    final active = statuses
        .where(
          (value) => !value.contains('CANCEL') && !value.contains('REJECT'),
        )
        .toList(growable: false);
    if (active.isEmpty) return OrderStatus.cancelled;
    if (active.any((value) => value.contains('PENDING'))) {
      return OrderStatus.pending;
    }
    if (active.any(
      (value) => value.contains('ACCEPT') || value.contains('PACK'),
    )) {
      return OrderStatus.confirmed;
    }
    if (active.any((value) => value.contains('SHIP'))) {
      return OrderStatus.shipped;
    }
    if (active.every((value) => value.contains('DELIVER'))) {
      return OrderStatus.delivered;
    }
    return OrderStatus.fromString(active.first);
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

  // These fields are serialized by toJson for the map-based cache. They are
  // intentionally outside the legacy Hive field table to preserve adapters.
  final int? summaryItemCount;
  final String? paymentStatus;
  final String? carrier;
  final String? shippingMethod;
  final String? sellerId;

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
    this.summaryItemCount,
    this.paymentStatus,
    this.carrier,
    this.shippingMethod,
    this.sellerId,
  });

  factory OrderModel.fromJson(Map<String, dynamic> json) {
    final rawSubOrders = _maps(json['subOrders'] ?? json['sub_orders']);
    final rawTopLevelItems = _maps(json['items'] ?? json['order_items']);
    final rawItems = rawTopLevelItems.isNotEmpty
        ? rawTopLevelItems
        : rawSubOrders
              .expand((subOrder) => _maps(subOrder['items']))
              .toList(growable: false);
    final rawAddress = json['shippingAddress'] ?? json['shipping_address'];
    final address = rawAddress is Map
        ? Map<String, dynamic>.from(rawAddress)
        : const <String, dynamic>{};
    final fulfillmentStatuses = rawSubOrders
        .map(
          (subOrder) =>
              _string(subOrder['fulfillmentStatus'] ?? subOrder['status']),
        )
        .where((value) => value.isNotEmpty);
    final paymentStatus = _nullableString(
      json['paymentStatus'] ?? json['payment_status'],
    );
    final status = rawSubOrders.isNotEmpty
        ? OrderStatus.fromFulfillmentStatuses(fulfillmentStatuses)
        : OrderStatus.fromString(json['status']);

    return OrderModel(
      id: _string(json['id'] ?? json['orderId'] ?? json['order_id']),
      orderNumber: _string(
        json['orderNumber'] ??
            json['order_number'] ??
            json['orderId'] ??
            json['order_id'],
      ),
      status: status,
      items: rawItems.map(OrderItemModel.fromJson).toList(growable: false),
      subtotal: _moneyAmount(
        json['itemsTotal'] ?? json['subtotal'] ?? json['sub_total'],
      ),
      shippingFee: _moneyAmount(
        json['shippingTotal'] ?? json['shippingFee'] ?? json['shipping_fee'],
      ),
      discount: _moneyAmount(json['discount']),
      totalAmount: _moneyAmount(
        json['finalAmount'] ??
            json['totalAmount'] ??
            json['total_amount'] ??
            json['total'],
      ),
      shippingAddress: _nullableString(
        address['street'] ??
            (rawAddress is String ? rawAddress : null) ??
            json['shippingStreet'] ??
            json['shipping_street'],
      ),
      shippingCity: _nullableString(
        address['city'] ?? json['shippingCity'] ?? json['shipping_city'],
      ),
      shippingDistrict: _nullableString(
        address['district'] ??
            json['shippingDistrict'] ??
            json['shipping_district'],
      ),
      shippingWard: _nullableString(
        address['ward'] ?? json['shippingWard'] ?? json['shipping_ward'],
      ),
      shippingPhone: _nullableString(
        json['shippingPhone'] ?? json['shipping_phone'],
      ),
      shippingName: _nullableString(
        json['shippingName'] ?? json['shipping_name'],
      ),
      note: _nullableString(json['note']),
      createdAt:
          _dateTime(json['createdAt'] ?? json['created_at']) ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      updatedAt: _dateTime(json['updatedAt'] ?? json['updated_at']),
      estimatedDelivery: _dateTime(
        json['estimatedDelivery'] ?? json['estimated_delivery'],
      ),
      trackingNumber:
          _firstSubOrderValue(
            rawSubOrders,
            'trackingNumber',
            'tracking_number',
          ) ??
          _nullableString(json['trackingNumber'] ?? json['tracking_number']),
      paymentMethod: _nullableString(
        json['paymentMethod'] ?? json['payment_method'],
      ),
      isPaid:
          _bool(json['isPaid'] ?? json['is_paid']) ||
          paymentStatus == 'COMPLETED' ||
          paymentStatus == 'PAID',
      summaryItemCount: _nullableInt(json['itemCount'] ?? json['item_count']),
      paymentStatus: paymentStatus,
      carrier:
          _firstSubOrderValue(rawSubOrders, 'carrier') ??
          _nullableString(json['carrier']),
      shippingMethod:
          _firstSubOrderValue(
            rawSubOrders,
            'shippingMethod',
            'shipping_method',
          ) ??
          _nullableString(json['shippingMethod'] ?? json['shipping_method']),
      sellerId: _nullableString(json['sellerId'] ?? json['seller_id']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'order_number': orderNumber,
      'status': status.value,
      'items': items.map((item) => item.toJson()).toList(growable: false),
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
      'created_at': hasCreatedAt ? createdAt.toIso8601String() : null,
      'updated_at': updatedAt?.toIso8601String(),
      'estimated_delivery': estimatedDelivery?.toIso8601String(),
      'tracking_number': trackingNumber,
      'payment_method': paymentMethod,
      'is_paid': isPaid,
      'item_count': summaryItemCount,
      'payment_status': paymentStatus,
      'carrier': carrier,
      'shipping_method': shippingMethod,
      'seller_id': sellerId,
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
    int? summaryItemCount,
    String? paymentStatus,
    String? carrier,
    String? shippingMethod,
    String? sellerId,
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
      summaryItemCount: summaryItemCount ?? this.summaryItemCount,
      paymentStatus: paymentStatus ?? this.paymentStatus,
      carrier: carrier ?? this.carrier,
      shippingMethod: shippingMethod ?? this.shippingMethod,
      sellerId: sellerId ?? this.sellerId,
    );
  }

  OrderModel mergeSummaryMetadata(OrderModel? summary) {
    if (summary == null) return this;
    return copyWith(
      createdAt: hasCreatedAt ? createdAt : summary.createdAt,
      updatedAt: updatedAt ?? summary.updatedAt,
      summaryItemCount: summaryItemCount ?? summary.summaryItemCount,
      sellerId: sellerId ?? summary.sellerId,
    );
  }

  int get itemCount =>
      summaryItemCount ??
      items.fold<int>(0, (sum, item) => sum + item.quantity);

  bool get hasCreatedAt => createdAt.millisecondsSinceEpoch > 0;

  bool get canCancel =>
      status == OrderStatus.pending || status == OrderStatus.confirmed;

  String get fullShippingAddress => [
    shippingAddress,
    shippingWard,
    shippingDistrict,
    shippingCity,
  ].whereType<String>().where((part) => part.trim().isNotEmpty).join(', ');

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
    summaryItemCount,
    paymentStatus,
    carrier,
    shippingMethod,
    sellerId,
  ];
}

List<Map<String, dynamic>> _maps(Object? value) {
  if (value is! List) return const [];
  return value
      .whereType<Map>()
      .map((item) => Map<String, dynamic>.from(item))
      .toList(growable: false);
}

double _moneyAmount(Object? value) {
  final raw = value is Map ? value['amount'] : value;
  if (raw is num) return raw.toDouble();
  return double.tryParse(raw?.toString() ?? '') ?? 0;
}

DateTime? _dateTime(Object? value) {
  if (value is DateTime) return value;
  return DateTime.tryParse(value?.toString() ?? '');
}

int? _nullableInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? '');
}

bool _bool(Object? value) {
  if (value is bool) return value;
  return value?.toString().toLowerCase() == 'true';
}

String _string(Object? value) => value?.toString() ?? '';

String? _nullableString(Object? value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

String? _firstSubOrderValue(
  List<Map<String, dynamic>> subOrders,
  String primaryKey, [
  String? secondaryKey,
]) {
  for (final subOrder in subOrders) {
    final value = _nullableString(
      subOrder[primaryKey] ??
          (secondaryKey == null ? null : subOrder[secondaryKey]),
    );
    if (value != null) return value;
  }
  return null;
}
