import 'package:equatable/equatable.dart';

enum PaymentStatus {
  pending,
  processing,
  completed,
  failed,
  cancelled,
  refunded,
}

enum PaymentMethod {
  vnpay,
  momo,
  vietqr,
  cod,
  bankTransfer,
}

class PaymentTransaction extends Equatable {
  final String id;
  final String orderId;
  final String idempotencyKey;
  final PaymentMethod method;
  final PaymentStatus status;
  final double amount;
  final String? transactionRef;
  final String? paymentUrl;
  final String? qrCodeUrl;
  final String? errorCode;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime? completedAt;
  final int attemptCount;
  final Map<String, dynamic>? metadata;

  const PaymentTransaction({
    required this.id,
    required this.orderId,
    required this.idempotencyKey,
    required this.method,
    required this.status,
    required this.amount,
    this.transactionRef,
    this.paymentUrl,
    this.qrCodeUrl,
    this.errorCode,
    this.errorMessage,
    required this.createdAt,
    this.completedAt,
    this.attemptCount = 1,
    this.metadata,
  });

  String get methodLabel {
    switch (method) {
      case PaymentMethod.vnpay:
        return 'VNPay';
      case PaymentMethod.momo:
        return 'MoMo';
      case PaymentMethod.vietqr:
        return 'VietQR';
      case PaymentMethod.cod:
        return 'Thanh toán khi nhận hàng';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản ngân hàng';
    }
  }

  String get statusLabel {
    switch (status) {
      case PaymentStatus.pending:
        return 'Đang chờ';
      case PaymentStatus.processing:
        return 'Đang xử lý';
      case PaymentStatus.completed:
        return 'Hoàn thành';
      case PaymentStatus.failed:
        return 'Thất bại';
      case PaymentStatus.cancelled:
        return 'Đã hủy';
      case PaymentStatus.refunded:
        return 'Đã hoàn tiền';
    }
  }

  bool get isPending => status == PaymentStatus.pending;
  bool get isCompleted => status == PaymentStatus.completed;
  bool get isFailed => status == PaymentStatus.failed;

  PaymentTransaction copyWith({
    String? id,
    String? orderId,
    String? idempotencyKey,
    PaymentMethod? method,
    PaymentStatus? status,
    double? amount,
    String? transactionRef,
    String? paymentUrl,
    String? qrCodeUrl,
    String? errorCode,
    String? errorMessage,
    DateTime? createdAt,
    DateTime? completedAt,
    int? attemptCount,
    Map<String, dynamic>? metadata,
  }) {
    return PaymentTransaction(
      id: id ?? this.id,
      orderId: orderId ?? this.orderId,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      method: method ?? this.method,
      status: status ?? this.status,
      amount: amount ?? this.amount,
      transactionRef: transactionRef ?? this.transactionRef,
      paymentUrl: paymentUrl ?? this.paymentUrl,
      qrCodeUrl: qrCodeUrl ?? this.qrCodeUrl,
      errorCode: errorCode ?? this.errorCode,
      errorMessage: errorMessage ?? this.errorMessage,
      createdAt: createdAt ?? this.createdAt,
      completedAt: completedAt ?? this.completedAt,
      attemptCount: attemptCount ?? this.attemptCount,
      metadata: metadata ?? this.metadata,
    );
  }

  factory PaymentTransaction.fromJson(Map<String, dynamic> json) {
    return PaymentTransaction(
      id: json['id'] as String? ?? '',
      orderId: json['orderId'] as String? ?? json['order_id'] as String? ?? '',
      idempotencyKey: json['idempotencyKey'] as String? ??
          json['idempotency_key'] as String? ??
          '',
      method: _parsePaymentMethod(json['method'] as String?),
      status: _parsePaymentStatus(json['status'] as String?),
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      transactionRef: json['transactionRef'] as String? ??
          json['transaction_ref'] as String? ??
          json['transactionRef'] as String?,
      paymentUrl: json['paymentUrl'] as String? ??
          json['payment_url'] as String? ??
          json['paymentUrl'] as String?,
      qrCodeUrl: json['qrCodeUrl'] as String? ??
          json['qr_code_url'] as String? ??
          json['qrCodeUrl'] as String?,
      errorCode: json['errorCode'] as String? ??
          json['error_code'] as String? ??
          json['errorCode'] as String?,
      errorMessage: json['errorMessage'] as String? ??
          json['error_message'] as String? ??
          json['errorMessage'] as String?,
      createdAt: json['createdAt'] != null
          ? DateTime.parse(json['createdAt'] as String)
          : json['created_at'] != null
              ? DateTime.parse(json['created_at'] as String)
              : DateTime.now(),
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : json['completed_at'] != null
              ? DateTime.parse(json['completed_at'] as String)
              : null,
      attemptCount: json['attemptCount'] as int? ??
          json['attempt_count'] as int? ??
          1,
      metadata: json['metadata'] as Map<String, dynamic>?,
    );
  }

  static PaymentMethod _parsePaymentMethod(String? method) {
    switch (method?.toLowerCase()) {
      case 'vnpay':
        return PaymentMethod.vnpay;
      case 'momo':
        return PaymentMethod.momo;
      case 'vietqr':
      case 'viet_qr':
      case 'vietqr':
        return PaymentMethod.vietqr;
      case 'cod':
      case 'cash_on_delivery':
        return PaymentMethod.cod;
      case 'bank_transfer':
      case 'banktransfer':
        return PaymentMethod.bankTransfer;
      default:
        return PaymentMethod.vnpay;
    }
  }

  static PaymentStatus _parsePaymentStatus(String? status) {
    switch (status?.toLowerCase()) {
      case 'pending':
        return PaymentStatus.pending;
      case 'processing':
        return PaymentStatus.processing;
      case 'completed':
      case 'success':
        return PaymentStatus.completed;
      case 'failed':
      case 'failure':
        return PaymentStatus.failed;
      case 'cancelled':
      case 'canceled':
        return PaymentStatus.cancelled;
      case 'refunded':
        return PaymentStatus.refunded;
      default:
        return PaymentStatus.pending;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'orderId': orderId,
      'idempotencyKey': idempotencyKey,
      'method': method.name,
      'status': status.name,
      'amount': amount,
      'transactionRef': transactionRef,
      'paymentUrl': paymentUrl,
      'qrCodeUrl': qrCodeUrl,
      'errorCode': errorCode,
      'errorMessage': errorMessage,
      'createdAt': createdAt.toIso8601String(),
      'completedAt': completedAt?.toIso8601String(),
      'attemptCount': attemptCount,
      'metadata': metadata,
    };
  }

  @override
  List<Object?> get props => [
        id,
        orderId,
        idempotencyKey,
        method,
        status,
        amount,
        transactionRef,
        paymentUrl,
        qrCodeUrl,
        errorCode,
        errorMessage,
        createdAt,
        completedAt,
        attemptCount,
        metadata,
      ];
}
