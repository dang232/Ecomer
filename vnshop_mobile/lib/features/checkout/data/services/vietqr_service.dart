import 'dart:core';

/// VietQR payment service for Vietnam
/// VietQR is an open standard: https://vietqr.io/
class VietQRService {
  VietQRService({
    required this.merchantId,
    required this.merchantName,
    this.mode = VietQRMode.test,
  });

  final String merchantId;
  final String merchantName;
  final VietQRMode mode;

  /// Generate VietQR payment URL/image
  /// amount: in VND (integer)
  /// orderId: unique order reference
  Future<VietQRPayment> generatePayment({
    required int amount,
    required String orderId,
    String? description,
  }) async {
    final bankId = mode == VietQRMode.production ? 'YOUR_BANK_ID' : '970436';
    final accountNumber =
        mode == VietQRMode.production ? 'YOUR_ACCOUNT' : '1234567890';

    // VietQR format
    final qrData = _buildQRString(
      bankId: bankId,
      accountNumber: accountNumber,
      amount: amount,
      orderId: orderId,
      description: description,
    );

    // Generate QR code URL for VietQR
    final qrImageUrl =
        'https://img.vietqr.io/image/$bankId-$accountNumber-compact.png'
        '?amount=$amount'
        '&addInfo=${Uri.encodeComponent(description ?? 'Thanh toan don hang $orderId')}'
        '&accountName=${Uri.encodeComponent(merchantName)}';

    return VietQRPayment(
      qrData: qrData,
      qrImageUrl: qrImageUrl,
      amount: amount,
      orderId: orderId,
      bankId: bankId,
      accountNumber: accountNumber,
    );
  }

  String _padRight(String s, int length) {
    if (s.length >= length) return s;
    return s + ' ' * (length - s.length);
  }

  String _padEnd(String s, int length) {
    if (s.length >= length) return s;
    return s + ' ' * (length - s.length);
  }

  String _padStart(String s, int length) {
    if (s.length >= length) return s;
    return ' ' * (length - s.length) + s;
  }

  String _buildQRString({
    required String bankId,
    required String accountNumber,
    required int amount,
    required String orderId,
    String? description,
  }) {
    // VietQR format: https://vietqr.io/
    return '00020101021138540010${_padRight(bankId, 10)}'
        '${_padRight(accountNumber, 20)}'
        '011500${_padEnd(merchantId, 15)}'
        '0208${_padEnd(orderId, 20)}'
        '030${_padStart(amount.toString(), 12)}'
        '${description != null ? '05${description.substring(0, description.length.clamp(0, 50))}' : ''}';
  }
}

enum VietQRMode { test, production }

class VietQRPayment {
  final String qrData;
  final String qrImageUrl;
  final int amount;
  final String orderId;
  final String bankId;
  final String accountNumber;

  const VietQRPayment({
    required this.qrData,
    required this.qrImageUrl,
    required this.amount,
    required this.orderId,
    required this.bankId,
    required this.accountNumber,
  });
}
