import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';

import 'address_model.dart';
import 'shipping_quote.dart';

/// Represents a single line item in the checkout session
class LineItem extends Equatable {
  final String productId;
  final String? variantSku;
  final int quantity;

  const LineItem({
    required this.productId,
    this.variantSku,
    required this.quantity,
  });

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      if (variantSku != null) 'variantSku': variantSku,
      'quantity': quantity,
    };
  }

  factory LineItem.fromJson(Map<String, dynamic> json) {
    return LineItem(
      productId: json['productId'] as String? ?? '',
      variantSku: json['variantSku'] as String?,
      quantity: json['quantity'] as int? ?? 1,
    );
  }

  @override
  List<Object?> get props => [productId, variantSku, quantity];
}

class CheckoutSession extends Equatable {
  final String sessionId;
  final String idempotencyKey;
  final String userId;
  final List<LineItem> lineItems;
  final VietnamAddress? selectedAddress;
  final ShippingQuote? selectedShipping;
  final String? selectedPaymentMethod;
  final String? couponCode;
  final double subtotal;
  final double shippingFee;
  final double discountAmount;
  final double totalAmount;
  final DateTime createdAt;
  final DateTime? expiresAt;
  final int paymentAttemptCount;

  const CheckoutSession({
    required this.sessionId,
    required this.idempotencyKey,
    required this.userId,
    required this.lineItems,
    this.selectedAddress,
    this.selectedShipping,
    this.selectedPaymentMethod,
    this.couponCode,
    required this.subtotal,
    required this.shippingFee,
    required this.discountAmount,
    required this.totalAmount,
    required this.createdAt,
    this.expiresAt,
    this.paymentAttemptCount = 0,
  });

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  bool get isComplete {
    return selectedAddress != null &&
        selectedShipping != null &&
        selectedPaymentMethod != null;
  }

  CheckoutSession copyWith({
    String? sessionId,
    String? idempotencyKey,
    String? userId,
    List<LineItem>? lineItems,
    VietnamAddress? selectedAddress,
    ShippingQuote? selectedShipping,
    String? selectedPaymentMethod,
    String? couponCode,
    double? subtotal,
    double? shippingFee,
    double? discountAmount,
    double? totalAmount,
    DateTime? createdAt,
    DateTime? expiresAt,
    int? paymentAttemptCount,
  }) {
    return CheckoutSession(
      sessionId: sessionId ?? this.sessionId,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      userId: userId ?? this.userId,
      lineItems: lineItems ?? this.lineItems,
      selectedAddress: selectedAddress ?? this.selectedAddress,
      selectedShipping: selectedShipping ?? this.selectedShipping,
      selectedPaymentMethod: selectedPaymentMethod ?? this.selectedPaymentMethod,
      couponCode: couponCode ?? this.couponCode,
      subtotal: subtotal ?? this.subtotal,
      shippingFee: shippingFee ?? this.shippingFee,
      discountAmount: discountAmount ?? this.discountAmount,
      totalAmount: totalAmount ?? this.totalAmount,
      createdAt: createdAt ?? this.createdAt,
      expiresAt: expiresAt ?? this.expiresAt,
      paymentAttemptCount: paymentAttemptCount ?? this.paymentAttemptCount,
    );
  }

  CheckoutSession incrementPaymentAttempt() {
    return copyWith(paymentAttemptCount: paymentAttemptCount + 1);
  }

  CheckoutSession generateNewIdempotencyKey() {
    return copyWith(
      idempotencyKey: const Uuid().v4(),
      paymentAttemptCount: 0,
    );
  }

  static CheckoutSession fromBreakdown({
    required String userId,
    required List<LineItem> lineItems,
    required Map<String, dynamic> breakdown,
    required double subtotalFallback,
    double discountFallback = 0,
    String? couponCode,
  }) {
    double number(String key, double fallback) {
      return (breakdown[key] as num?)?.toDouble() ?? fallback;
    }

    final subtotal = number('itemsTotal', subtotalFallback);
    final shippingFee = number('shippingEstimate', 0);
    final discountAmount = number('discount', discountFallback);

    return CheckoutSession(
      sessionId: const Uuid().v4(),
      idempotencyKey: const Uuid().v4(),
      userId: userId,
      lineItems: lineItems,
      subtotal: subtotal,
      shippingFee: shippingFee,
      discountAmount: discountAmount,
      totalAmount: number('finalAmount', subtotal + shippingFee - discountAmount),
      couponCode: couponCode,
      createdAt: DateTime.now(),
    );
  }

  factory CheckoutSession.create({
    required String userId,
    required List<LineItem> lineItems,
    required double subtotal,
    double discountAmount = 0,
    String? couponCode,
    Duration expirationDuration = const Duration(minutes: 30),
  }) {
    final now = DateTime.now();
    return CheckoutSession(
      sessionId: const Uuid().v4(),
      idempotencyKey: const Uuid().v4(),
      userId: userId,
      lineItems: lineItems,
      subtotal: subtotal,
      shippingFee: 0,
      discountAmount: discountAmount,
      couponCode: couponCode,
      totalAmount: subtotal - discountAmount,
      createdAt: now,
      expiresAt: now.add(expirationDuration),
    );
  }

  factory CheckoutSession.fromJson(Map<String, dynamic> json) {
    final items = json['lineItems'] as List<dynamic>?;
    final parsedLineItems = items != null
        ? items
            .map((e) => LineItem.fromJson(e as Map<String, dynamic>))
            .toList()
        : <LineItem>[];
    return CheckoutSession(
      sessionId: json['sessionId'] as String? ?? json['session_id'] as String? ?? '',
      idempotencyKey: json['idempotencyKey'] as String? ??
          json['idempotency_key'] as String? ??
          const Uuid().v4(),
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
      lineItems: parsedLineItems,
      selectedAddress: json['selectedAddress'] != null
          ? VietnamAddress.fromJson(
              json['selectedAddress'] as Map<String, dynamic>)
          : null,
      selectedShipping: json['selectedShipping'] != null
          ? ShippingQuote.fromJson(
              json['selectedShipping'] as Map<String, dynamic>)
          : null,
      selectedPaymentMethod: json['selectedPaymentMethod'] as String? ??
          json['selected_payment_method'] as String?,
      couponCode: json['couponCode'] as String? ??
          json['coupon_code'] as String?,
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      shippingFee: (json['shippingFee'] as num?)?.toDouble() ??
          (json['shipping_fee'] as num?)?.toDouble() ??
          0.0,
      discountAmount: (json['discountAmount'] as num?)?.toDouble() ??
          (json['discount_amount'] as num?)?.toDouble() ??
          0.0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ??
          (json['total_amount'] as num?)?.toDouble() ??
          0.0,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'] as String)
              : DateTime.now(),
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : json['expires_at'] != null
              ? DateTime.parse(json['expires_at'] as String)
              : null,
      paymentAttemptCount: json['paymentAttemptCount'] as int? ??
          json['payment_attempt_count'] as int? ??
          0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'idempotencyKey': idempotencyKey,
      'userId': userId,
      'lineItems': lineItems.map((e) => e.toJson()).toList(),
      'selectedAddress': selectedAddress?.toJson(),
      'selectedShipping': selectedShipping?.toJson(),
      'selectedPaymentMethod': selectedPaymentMethod,
      'couponCode': couponCode,
      'subtotal': subtotal,
      'shippingFee': shippingFee,
      'discountAmount': discountAmount,
      'totalAmount': totalAmount,
      'createdAt': createdAt.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'paymentAttemptCount': paymentAttemptCount,
    };
  }

  @override
  List<Object?> get props => [
        sessionId,
        idempotencyKey,
        userId,
        lineItems,
        selectedAddress,
        selectedShipping,
        selectedPaymentMethod,
        couponCode,
        subtotal,
        shippingFee,
        discountAmount,
        totalAmount,
        createdAt,
        expiresAt,
        paymentAttemptCount,
      ];
}
