import 'package:vnshop_mobile/features/checkout/data/models/payment_transaction.dart';

/// Extension to provide payment method metadata
extension PaymentMethodExtension on PaymentMethod {
  String get displayName {
    switch (this) {
      case PaymentMethod.cod:
        return 'Cash on Delivery';
      case PaymentMethod.vietqr:
        return 'VietQR';
      case PaymentMethod.momo:
        return 'MoMo';
      case PaymentMethod.vnpay:
        return 'VNPay';
      case PaymentMethod.bankTransfer:
        return 'Bank Transfer';
    }
  }

  String get displayNameVi {
    switch (this) {
      case PaymentMethod.cod:
        return 'Thanh toán khi nhận hàng';
      case PaymentMethod.vietqr:
        return 'Quét mã QR VietQR';
      case PaymentMethod.momo:
        return 'Ví MoMo';
      case PaymentMethod.vnpay:
        return 'Thanh toán qua VNPay';
      case PaymentMethod.bankTransfer:
        return 'Chuyển khoản ngân hàng';
    }
  }
}

/// Returns all available payment methods
List<PaymentMethod> getAvailablePaymentMethods() {
  return PaymentMethod.values;
}
