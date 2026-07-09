import 'package:equatable/equatable.dart';
import 'package:uuid/uuid.dart';

import 'address_model.dart';
import 'shipping_quote.dart';

class CheckoutSession extends Equatable {
  final String sessionId;
  final String idempotencyKey;
  final String userId;
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

  factory CheckoutSession.create({
    required String userId,
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
    return CheckoutSession(
      sessionId: json['sessionId'] as String? ?? json['session_id'] as String? ?? '',
      idempotencyKey: json['idempotencyKey'] as String? ??
          json['idempotency_key'] as String? ??
          const Uuid().v4(),
      userId: json['userId'] as String? ?? json['user_id'] as String? ?? '',
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
